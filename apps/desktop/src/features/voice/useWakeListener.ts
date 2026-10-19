import { useCallback, useEffect, useRef, useState } from "react";
import { transcribe } from "../../services/ai";

export type ListenerState = "off" | "armed" | "capturing" | "transcribing";

const POLL_MS = 50;
/** Speech must stand this far above the measured room noise. */
const SPEECH_OVER_FLOOR = 4;
const MIN_SPEECH_RMS = 0.008;
/** How fast the floor rises toward a louder sustained level (per tick). */
const FLOOR_RISE_RATE = 0.02;
/** How fast it snaps down when the room gets quieter (per tick). */
const FLOOR_FALL_RATE = 0.3;
const SILENCE_HOLD_MS = 1200;
const MIN_SEGMENT_MS = 400;
const CLICK_GRACE_MS = 4000;
/** Frames above the threshold before a segment is worth uploading. */
const MIN_SPEECH_FRAMES = 8;
const MAX_SEGMENT_MS = 15_000;
const MIN_FORCED_SEGMENT_MS = 1500;
/** Chunk length of the always-running recorder. */
const CHUNK_MS = 250;
/** Chunks kept before speech was noticed, so the wake phrase is never clipped. */
const PREROLL_CHUNKS = 4;

interface Options {
  /** Continuous wake-phrase listening. Click-to-talk works either way. */
  enabled: boolean;
  phrases: string[];
  onUtterance: (text: string) => void;
}

/**
 * Microphone listener for the orb.
 *
 * - Click (`captureNow`): always starts a listen session immediately (no wake
 *   phrase needed). Mic opens on demand if it was off.
 * - Always-listening (`enabled`): keeps the mic open and only forwards speech
 *   that contains a wake phrase (unless a click forced the segment).
 *
 * After a click-only session finishes, the mic is released again when
 * always-listening is off.
 */
export function useWakeListener({ enabled, phrases, onUtterance }: Options) {
  const [state, setState] = useState<ListenerState>("off");
  const [error, setError] = useState<string | null>(null);
  const [lastHeard, setLastHeard] = useState<string | null>(null);

  const forced = useRef(false);
  const captureRequested = useRef(false);
  /** True while a one-shot click session is active (mic not continuously armed). */
  const oneShot = useRef(false);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const callbacks = useRef({ phrases, onUtterance });
  callbacks.current = { phrases, onUtterance };

  // Runtime handles so captureNow can start a session when the effect is idle.
  const runtime = useRef<{
    startOneShot: () => void;
    requestCapture: () => void;
  } | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let context: AudioContext | null = null;
    let recorder: MediaRecorder | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;
    let starting = false;

    // chunks[0] carries the container header and is always kept.
    let chunks: Blob[] = [];
    let segmentStart: number | null = null;
    let segmentStartedAt = 0;
    let silenceSince: number | null = null;
    let speechFrames = 0;

    function tearDown() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      if (recorder && recorder.state !== "inactive") {
        try {
          recorder.stop();
        } catch {
          /* already stopped */
        }
      }
      recorder = null;
      void context?.close();
      context = null;
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;
      chunks = [];
      segmentStart = null;
      oneShot.current = false;
      forced.current = false;
      captureRequested.current = false;
      if (!cancelled) setState("off");
    }

    async function closeSegment() {
      if (segmentStart === null || !recorder) return;

      const duration = Date.now() - segmentStartedAt;
      const wasForced = forced.current;
      const wasOneShot = oneShot.current;
      const heardEnough = wasForced || speechFrames >= MIN_SPEECH_FRAMES;
      const parts = [chunks[0]!, ...chunks.slice(segmentStart)];

      segmentStart = null;
      forced.current = false;
      chunks = [chunks[0]!, ...chunks.slice(-PREROLL_CHUNKS)];

      const minMs = wasForced || wasOneShot ? MIN_FORCED_SEGMENT_MS : MIN_SEGMENT_MS;
      if (duration < minMs || !heardEnough) {
        if (wasOneShot && !enabledRef.current) {
          tearDown();
        } else if (!cancelled) {
          setState("armed");
        }
        return;
      }

      const blob = new Blob(parts, { type: recorder.mimeType });
      if (blob.size === 0) {
        if (wasOneShot && !enabledRef.current) {
          tearDown();
        } else if (!cancelled) {
          setState("armed");
        }
        return;
      }

      setState("transcribing");

      try {
        const text = (await transcribe(blob)).trim();
        if (text) setLastHeard(text);

        // Click sessions always forward the full transcript (no wake phrase).
        const prompt = wakePrompt(text, callbacks.current.phrases, wasForced || wasOneShot);

        void fetch("http://127.0.0.1:4000/diag", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            heard: text,
            forced: wasForced || wasOneShot,
            seconds: Math.round(duration / 100) / 10,
            bytes: blob.size,
            forwarded: prompt,
          }),
        }).catch(() => undefined);

        if (prompt) callbacks.current.onUtterance(prompt);
      } catch (cause) {
        console.error("Wake listener transcription failed:", cause);
        setError(String(cause));
      } finally {
        if (cancelled) return;

        // One-shot click: release the mic when always-listening is off.
        if (wasOneShot && !enabledRef.current) {
          tearDown();
        } else {
          oneShot.current = false;
          setState("armed");
        }
      }
    }
    async function arm(opts: { forceCapture: boolean; asOneShot: boolean }) {
      if (starting || stream) {
        if (opts.forceCapture) captureRequested.current = true;
        return;
      }
      starting = true;

      try {
        const deviceId = await pickMicrophone();

        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          stream = null;
          return;
        }

        context = new AudioContext();
        // WebKit hands back a suspended context, and a suspended analyser
        // reports pure silence — so nothing would ever sound like speech.
        if (context.state === "suspended") await context.resume();

        const source = context.createMediaStreamSource(stream);
        const analyser = context.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser);

        const mimeType = pickMimeType();
        recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        recorder.ondataavailable = (event) => {
          if (event.data.size === 0) return;
          chunks.push(event.data);

          // Bound memory while no segment is open.
          if (segmentStart === null && chunks.length > PREROLL_CHUNKS + 1) {
            chunks = [chunks[0]!, ...chunks.slice(-PREROLL_CHUNKS)];
          }
        };
        recorder.start(CHUNK_MS);

        const samples = new Uint8Array(analyser.fftSize);
        let noiseFloor = 0.002;
        oneShot.current = opts.asOneShot;
        setError(null);

        if (opts.forceCapture) {
          // Wait one chunk so MediaRecorder has a header + some audio.
          captureRequested.current = true;
          setState("capturing");
        } else {
          setState("armed");
        }

        let heartbeat = 0;

        timer = setInterval(() => {
          analyser.getByteTimeDomainData(samples);

          const rms = frameRms(samples);
          const threshold = speechThreshold(noiseFloor);
          const isSpeech = rms > threshold;
          noiseFloor = updatedNoiseFloor(noiseFloor, rms);

          if (++heartbeat % 10 === 0) {
            void fetch("http://127.0.0.1:4000/diag", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                tick: true,
                rms: Math.round(rms * 10000) / 10000,
                noiseFloor: Math.round(noiseFloor * 10000) / 10000,
                threshold: Math.round(threshold * 10000) / 10000,
                isSpeech,
                hasSegment: segmentStart !== null,
              }),
            }).catch(() => undefined);
          }

          if (segmentStart === null) {
            if (!isSpeech && !captureRequested.current) {
              return;
            }

            forced.current = captureRequested.current;
            captureRequested.current = false;
            segmentStart = Math.max(1, chunks.length - PREROLL_CHUNKS);
            segmentStartedAt = Date.now();
            silenceSince = null;
            speechFrames = isSpeech ? 1 : 0;
            setState("capturing");
            return;
          }

          if (isSpeech) {
            silenceSince = null;
            speechFrames++;
          } else {
            silenceSince ??= Date.now();
          }

          const quietLongEnough =
            silenceSince !== null && Date.now() - silenceSince > SILENCE_HOLD_MS;
          const tooLong = Date.now() - segmentStartedAt > MAX_SEGMENT_MS;

          if (quietLongEnough || tooLong) void closeSegment();
        }, POLL_MS);
      } catch (cause) {
        setError(String(cause));
        setState("off");
        stream?.getTracks().forEach((track) => track.stop());
        stream = null;
        oneShot.current = false;
      } finally {
        starting = false;
      }
    }

    runtime.current = {
      startOneShot: () => {
        void arm({ forceCapture: true, asOneShot: true });
      },
      requestCapture: () => {
        captureRequested.current = true;
      },
    };

    // A headset plugged or unplugged mid-session should take over immediately,
    // rather than waiting for the next time listening is toggled off and on.
    function handleDeviceChange() {
      if (cancelled || !enabled || starting || segmentStart !== null) return;
      tearDown();
      void arm({ forceCapture: false, asOneShot: false });
    }

    navigator.mediaDevices.addEventListener?.("devicechange", handleDeviceChange);

    if (enabled) {
      void arm({ forceCapture: false, asOneShot: false });
    } else {
      setState("off");
    }

    return () => {
      cancelled = true;
      runtime.current = null;
      navigator.mediaDevices.removeEventListener?.("devicechange", handleDeviceChange);
      tearDown();
    };
  }, [enabled]);

  const captureNow = useCallback(() => {
    // Already in a continuous or one-shot session → force the next segment.
    if (state === "armed" || state === "capturing") {
      captureRequested.current = true;
      runtime.current?.requestCapture();
      return;
    }

    // Mic is off (always-listening disabled) → open mic and start listening now.
    if (state === "off" || state === "transcribing") {
      runtime.current?.startOneShot();
      // If effect hasn't registered runtime yet, flag for when it does.
      captureRequested.current = true;
    }
  }, [state]);

  return { state, error, lastHeard, captureNow };
}

/** RMS of one analyser frame, where 128 is silence. */
export function frameRms(samples: Uint8Array): number {
  let sum = 0;
  for (const sample of samples) {
    const centred = (sample - 128) / 128;
    sum += centred * centred;
  }
  return Math.sqrt(sum / samples.length);
}

export function speechThreshold(noiseFloor: number): number {
  return Math.max(noiseFloor * SPEECH_OVER_FLOOR, MIN_SPEECH_RMS);
}

/**
 * Tracks the ambient noise level even while speech is ongoing, so a loud but
 * steady room doesn't get stuck reading as permanent speech: it snaps down
 * fast when things get quieter, and only creeps up slowly otherwise — a real
 * voice is a brief spike well above this, not a sustained rise in it.
 */
export function updatedNoiseFloor(noiseFloor: number, rms: number): number {
  const rate = rms < noiseFloor ? FLOOR_FALL_RATE : FLOOR_RISE_RATE;
  return noiseFloor + (rms - noiseFloor) * rate;
}

export function wakePrompt(text: string, phrases: string[], forced: boolean): string | null {
  if (!text) return null;
  if (forced) return text;

  const normalised = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

  for (const phrase of phrases) {
    const needle = phrase.toLowerCase().trim();
    if (!needle) continue;

    const at = normalised.indexOf(needle);
    if (at === -1) continue;

    const rest = normalised.slice(at + needle.length).trim();
    return rest || phrase;
  }

  return null;
}

const BUILT_IN_MIC_PATTERN = /\b(built-?in|internal|mic ?1|laptop)\b/i;

/**
 * Prefers a plugged-in headset/headphone mic over the laptop's built-in one.
 * Falls back to the system default (no deviceId constraint) if nothing better
 * is plugged in, or if device labels aren't available yet.
 */
export async function pickMicrophone(): Promise<string | undefined> {
  if (!navigator.mediaDevices?.enumerateDevices) return undefined;

  const devices = await navigator.mediaDevices.enumerateDevices();
  const mics = devices.filter((device) => device.kind === "audioinput" && device.label);

  void fetch("http://127.0.0.1:4000/diag", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mics: mics.map((mic) => mic.label) }),
  }).catch(() => undefined);

  const external = mics.find((device) => !BUILT_IN_MIC_PATTERN.test(device.label));
  return external?.deviceId;
}

function pickMimeType() {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}