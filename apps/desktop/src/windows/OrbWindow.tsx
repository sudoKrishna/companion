import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { emit, listen } from "@tauri-apps/api/event";
import AssistantOrb, { type OrbStatus } from "../components/AssistantOrb";
import { speak } from "../services/ai";
import { usePreferences } from "../features/preferences/usePreferences";
import { useWakeListener } from "../features/voice/useWakeListener";

const DRAG_THRESHOLD_PX = 4;

export interface BrainState {
  isThinking: boolean;
  hasSuggestion: boolean;
}

export default function OrbWindow() {
  const [brain, setBrain] = useState<BrainState>({ isThinking: false, hasSuggestion: false });
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const didDrag = useRef(false);

  const { preferences } = usePreferences();

  const handleUtterance = useCallback((text: string) => {
    void emit("companion:utterance", { text });
  }, []);

  const listener = useWakeListener({
    enabled: preferences.alwaysListening,
    phrases: preferences.wakePhrases,
    onUtterance: handleUtterance,
  });

  useEffect(() => {
    const stop = listen<BrainState>("companion:state", (event) => setBrain(event.payload));
    return () => void stop.then((unlisten) => unlisten());
  }, []);

  // Replies are spoken here, so voice keeps working with the dashboard closed.
  useEffect(() => {
    const stop = listen<{ text: string }>("companion:reply", async (event) => {
      if (!preferences.speakReplies || !event.payload.text.trim()) return;

      try {
        setIsSpeaking(true);
        const audio = await speak(event.payload.text);
        const url = URL.createObjectURL(audio);
        const player = new Audio(url);

        await new Promise<void>((resolve) => {
          player.onended = () => resolve();
          player.onerror = () => resolve();
          void player.play().catch(() => resolve());
        });

        URL.revokeObjectURL(url);
      } catch (error) {
        console.error("Speech playback failed:", error);
      } finally {
        setIsSpeaking(false);
      }
    });

    return () => void stop.then((unlisten) => unlisten());
  }, [preferences.speakReplies]);

  const status: OrbStatus = isSpeaking
    ? "speaking"
    : listener.state === "capturing"
      ? "listening"
      : brain.isThinking || listener.state === "transcribing"
        ? "thinking"
        : "idle";

  async function openDashboard() {
    const main = await WebviewWindow.getByLabel("main");
    await main?.show();
    await main?.unminimize();
    await main?.setFocus();
  }

  function handleMouseDown(event: React.MouseEvent) {
    startPos.current = { x: event.clientX, y: event.clientY };
    didDrag.current = false;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!startPos.current) return;
      const dx = moveEvent.clientX - startPos.current.x;
      const dy = moveEvent.clientY - startPos.current.y;

      if (Math.hypot(dx, dy) > DRAG_THRESHOLD_PX && !didDrag.current) {
        didDrag.current = true;
        setIsDragging(true);
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
        getCurrentWindow()
          .startDragging()
          .finally(() => setIsDragging(false));
      }
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }

  const armed = listener.state !== "off";

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-transparent">
      <div
        onMouseDown={handleMouseDown}
        onContextMenu={(event) => {
          event.preventDefault();
          void openDashboard();
        }}
        title={[
          armed
            ? `Listening for "${preferences.wakePhrases[0] ?? "your wake phrase"}"`
            : "Always-listening is off",
          "Click to talk now · right-click for the dashboard",
          listener.lastHeard ? `Last heard: "${listener.lastHeard}"` : null,
        ]
          .filter(Boolean)
          .join("\n")}
        className={`relative ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
      >
        <AssistantOrb
          status={status}
          onClick={() => {
            if (!didDrag.current) listener.captureNow();
          }}
        />

        {armed && status === "idle" && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-violet-400/30"
          />
        )}

        {brain.hasSuggestion && (
          <span
            aria-label="Your companion has a suggestion"
            className="absolute right-0 top-0 size-3 animate-pulse rounded-full border-2 border-[#111116] bg-violet-400"
          />
        )}

        {listener.error && (
          <span
            title={`Microphone unavailable: ${listener.error}`}
            className="absolute bottom-0 left-0 size-3 rounded-full border-2 border-[#111116] bg-red-500"
          />
        )}
      </div>
    </div>
  );
}
