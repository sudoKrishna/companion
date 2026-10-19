import { useRef, useState } from "react";

export type RecorderState = "idle" | "recording" | "processing";

export function useRecorder() {
  const [state, setState] = useState<RecorderState>("idle");
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function start() {
    if (state !== "idle") return;
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: pickMimeType() });

      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorderRef.current = recorder;
      recorder.start();
      setState("recording");
    } catch (err) {
      setError(String(err));
      setState("idle");
    }
  }

  async function stop(): Promise<Blob | null> {
    const recorder = recorderRef.current;
    if (!recorder || state !== "recording") return null;

    setState("processing");

    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunksRef.current, { type: recorder.mimeType }));
      recorder.stop();
    });

    recorder.stream.getTracks().forEach((track) => track.stop());
    recorderRef.current = null;

    return blob.size > 0 ? blob : null;
  }

  function reset() {
    setState("idle");
  }

  return { state, error, start, stop, reset };
}

function pickMimeType() {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}
