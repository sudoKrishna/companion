import { useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalPosition, LogicalSize } from "@tauri-apps/api/dpi";
import AssistantOrb, { type OrbStatus } from "./components/AssistantOrb";
import ChatBox, { type ChatMessage } from "./components/ChatBox";


const DRAG_THRESHOLD_PX = 4;
const ORB_SIZE = new LogicalSize(72, 72);
const CHAT_SIZE = new LogicalSize(380, 560);

export default function App() {
  const [status] = useState<OrbStatus>("idle");
  const [mode, setMode] = useState<"orb" | "chat">("orb");
  const [isDragging, setIsDragging] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const didDrag = useRef(false);

  async function expand() {
    const win = getCurrentWindow();
    const currentPos = await win.outerPosition();
    const scaleFactor  = await win.scaleFactor();

    const logicalX = currentPos.x / scaleFactor;
    const logicalY = currentPos.y / scaleFactor;

    const newX = logicalX - (CHAT_SIZE.width - ORB_SIZE.width);
    const newY = logicalY - (CHAT_SIZE.height - ORB_SIZE.height);

    setMode("chat");
    await win.setSize(CHAT_SIZE);
    await win.setPosition(new LogicalPosition(Math.max(0, newX), Math.max(0, newY)));
  }



  async function collapse() {
   const win  = getCurrentWindow();
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
        <ChatBox
          messages={messages}
          isThinking={false}
          onSubmit={(content) => {
            // Placeholder echo response — replaced by real AI in Phase 3.
            const userMsg: ChatMessage = {
              id: crypto.randomUUID(),
              role: "user",
              content,
              createdAt: new Date(),
            };
            const assistantMsg: ChatMessage = {
              id: crypto.randomUUID(),
              role: "assistant",
              content: `(placeholder) You said: ${content}`,
              createdAt: new Date(),
            };
            setMessages((prev) => [...prev, userMsg, assistantMsg]);
          }}
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
