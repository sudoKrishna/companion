import { useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalPosition, LogicalSize } from "@tauri-apps/api/dpi";
import AssistantOrb, { type OrbStatus } from "./components/AssistantOrb";
import ChatBox, { type ChatMessage } from "./components/ChatBox";
import { invoke } from "@tauri-apps/api/core";



const DRAG_THRESHOLD_PX = 4;
const ORB_SIZE = new LogicalSize(72, 72);
const CHAT_SIZE = new LogicalSize(380, 560);

export default function App() {
  const [status] = useState<OrbStatus>("idle");
  const [mode, setMode] = useState<"orb" | "chat">("orb");
  const [isDragging, setIsDragging] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const didDrag = useRef(false);

  async function handleSubmit(content: string) {
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      createdAt: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsThinking(true);

    try {
      const history = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const reply = await invoke<string>("send_message", { history });

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: reply,
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error) {
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Error ${String(error)}`,
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setIsThinking(false)
    }
  }

  async function expand() {
    const win = getCurrentWindow();
    const currentPos = await win.outerPosition();
    const scaleFactor = await win.scaleFactor();

    const logicalX = currentPos.x / scaleFactor;
    const logicalY = currentPos.y / scaleFactor;

    const newX = logicalX - (CHAT_SIZE.width - ORB_SIZE.width);
    const newY = logicalY - (CHAT_SIZE.height - ORB_SIZE.height);

    setMode("chat");
    await win.setSize(CHAT_SIZE);
    await win.setPosition(new LogicalPosition(Math.max(0, newX), Math.max(0, newY)));
  }



  async function collapse() {
    const win = getCurrentWindow();
    const currentPos = await win.outerPosition();
    const scaleFactor = await win.scaleFactor();

    const logicalX = currentPos.x / scaleFactor;
    const logicalY = currentPos.y / scaleFactor;

    const newX = logicalX + (CHAT_SIZE.width - ORB_SIZE.width);
    const newY = logicalY + (CHAT_SIZE.height - ORB_SIZE.height);

    setMode("orb");
    await win.setSize(ORB_SIZE);
    await win.setPosition(new LogicalPosition(newX, newY));
  }

  function handleOrbMouseDown(e: React.MouseEvent) {
    startPos.current = { x: e.clientX, y: e.clientY };
    didDrag.current = false;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!startPos.current) return;
      const dx = moveEvent.clientX - startPos.current.x;
      const dy = moveEvent.clientY - startPos.current.y;
      const distance = Math.hypot(dx, dy);

      if (distance > DRAG_THRESHOLD_PX && !didDrag.current) {
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

  // Escape collapses back to the orb while in chat mode.
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape" && mode === "chat") collapse();
  }

  if (mode === "chat") {
    return (
      <div
        className="h-screen w-screen bg-transparent p-2"
        onKeyDown={handleKeyDown}
        tabIndex={-1}
        ref={(el) => el?.focus()}
      >
        <button
          onClick={async () => {
            try {
              const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
              console.log("Mic access granted. Tracks:", stream.getAudioTracks());
              stream.getTracks().forEach((t) => t.stop()); // release the mic right away, this is just a test
            } catch (err) {
              console.error("Mic access failed:", err);
            }
          }}
          className="absolute top-2 left-2 z-50 rounded bg-white/10 px-2 py-1 text-xs text-white"
        >
          Test Mic
        </button>
        <ChatBox
          messages={messages}
          isThinking={false}
          onSubmit={handleSubmit}
        />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-transparent">
      <div
        onMouseDown={handleOrbMouseDown}
        className={isDragging ? "cursor-grabbing" : "cursor-grab"}
      >
        <AssistantOrb
          status={status}
          onClick={() => {
            if (!didDrag.current) expand();
          }}
        />
      </div>
    </div>
  );
}
