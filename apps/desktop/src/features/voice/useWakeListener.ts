import { useCallback, useEffect, useRef, useState } from "react";
import { transcribe } from "../../services/ai";

export type ListenerState = "off" | "armed" | "capturing" | "transcribing";

const POLL_MS = 50;
/** Speech must stand this far above the measured room noise. */
const SPEECH_OVER_FLOOR = 4;
const MIN_SPEECH_RMS = 0.008;
const FLOOR_SMOOTHING = 0.95;
const SILENCE_HOLD_MS = 1200;
const MIN_SEGMENT_MS = 400;
/** Frames above the threshold before a segment is worth uploading. */
const MIN_SPEECH_FRAMES = 8;
const MAX_SEGMENT_MS = 15_000;
/** Chunk length of the always-running recorder. */
const CHUNK_MS = 250;
/** Chunks kept before speech was noticed, so the wake phrase is never clipped. */
const PREROLL_CHUNKS = 4;

interface Options {
  enabled: boolean;
  phrases: string[];
  onUtterance: (text: string) => void;
}

/**
 * Keeps the microphone open and the recorder running continuously, watching the
 * level locally. Only the stretches that contain speech are uploaded, and a
 * segment is forwarded when it carries one of the wake phrases — or when the orb
 * was clicked to capture directly.
 *
 * The recorder never stops, so each segment keeps a few chunks of pre-roll and
 * the opening words of the wake phrase survive.
 */
export function useWakeListener({ enabled, phrases, onUtterance }: Options) {
  const [state, setState] = useState<ListenerState>("off");
  const [error, setError] = useState<string | null>(null);
  const [lastHeard, setLastHeard] = useState<string | null>(null);

  const forced = useRef(false);
  const captureRequested = useRef(false);
  const callbacks = useRef({ phrases, onUtterance });
  callbacks.current = { phrases, onUtterance };

  useEffect(() => {
    if (!enabled) {
      setState("off");
      return;
    }

    let stream: MediaStream | null = null;
    let context: AudioContext | null = null;
    let recorder: MediaRecorder | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    // chunks[0] carries the container header and is always kept.
    let chunks: Blob[] = [];
    let segmentStart: number | null = null;
    let segmentStartedAt = 0;
    let silenceSince: number | null = null;
    let speechFrames = 0;

    async function arm() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
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
        setState("armed");
        setError(null);

        timer = setInterval(() => {
          analyser.getByteTimeDomainData(samples);

          const rms = frameRms(samples);
          const isSpeech = rms > speechThreshold(noiseFloor);

          if (segmentStart === null) {
            if (!isSpeech && !captureRequested.current) {
              noiseFloor = updatedNoiseFloor(noiseFloor, rms);
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
      }
    }

    async function closeSegment() {
      if (segmentStart === null || !recorder) return;

      const duration = Date.now() - segmentStartedAt;
      const wasForced = forced.current;
      const heardEnough = wasForced || speechFrames >= MIN_SPEECH_FRAMES;
      const parts = [chunks[0]!, ...chunks.slice(segmentStart)];

      segmentStart = null;
      forced.current = false;
      chunks = [chunks[0]!, ...chunks.slice(-PREROLL_CHUNKS)];

      if (duration < MIN_SEGMENT_MS || !heardEnough) {
        setState("armed");
        return;
      }

      const blob = new Blob(parts, { type: recorder.mimeType });
      if (blob.size === 0) {
        setState("armed");
        return;
      }

      setState("transcribing");

      try {
        const text = (await transcribe(blob)).trim();
        if (text) setLastHeard(text);

        const prompt = wakePrompt(text, callbacks.current.phrases, wasForced);

        void fetch("http://127.0.0.1:4000/diag", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            heard: text,
            forced: wasForced,
            seconds: Math.round(duration / 100) / 10,
            bytes: blob.size,
            forwarded: prompt,
          }),
        }).catch(() => undefined);

        if (prompt) callbacks.current.onUtterance(prompt);
      } catch (cause) {
        console.error("Wake listener transcription failed:", cause);
      } finally {
        if (!cancelled) setState("armed");
      }
    }

    void arm();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      if (recorder && recorder.state !== "inactive") recorder.stop();
      void context?.close();
      stream?.getTracks().forEach((track) => track.stop());
      setState("off");
    };
  }, [enabled]);

  const captureNow = useCallback(() => {
    captureRequested.current = true;
  }, []);

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

export function updatedNoiseFloor(noiseFloor: number, rms: number): number {
  return noiseFloor * FLOOR_SMOOTHING + rms * (1 - FLOOR_SMOOTHING);
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

function pickMimeType() {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}
