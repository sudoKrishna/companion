import { useEffect, useRef, useState } from "react";
import { emit, listen } from "@tauri-apps/api/event";
import ActivityLog from "../components/ActivityLog";
import ChatBox, { type ChatBoxHandle } from "../components/ChatBox";
import PermissionDialog from "../components/PermissionDialog";
import SettingsPanel from "../components/SettingsPanel";
import SuggestionBubble from "../components/SuggestionBubble";
import { transcribe } from "../services/ai";
import { useConversation } from "../features/conversation/useConversation";
import { usePreferences } from "../features/preferences/usePreferences";
import { useRecorder } from "../features/voice/useRecorder";
import { useSuggestions } from "../features/suggestions/useSuggestions";
import type { OrbStatus } from "../components/AssistantOrb";

type Section = "chat" | "activity" | "settings";

const SECTIONS: { id: Section; label: string }[] = [
  { id: "chat", label: "Chat" },
  { id: "activity", label: "Activity" },
  { id: "settings", label: "Settings" },
];

export default function DesktopWindow() {
  const [section, setSection] = useState<Section>("chat");
  const chatBoxRef = useRef<ChatBoxHandle>(null);

  const recorder = useRecorder();
  const { preferences, update } = usePreferences();
  const conversation = useConversation(preferences, {
    onReply: (text) => void emit("companion:reply", { text }),
  });
  const { suggestion, dismiss } = useSuggestions(preferences, conversation.isThinking);

  const status: OrbStatus =
    recorder.state === "recording"
      ? "listening"
      : conversation.isThinking
        ? "thinking"
        : "idle";

  const sendRef = useRef(conversation.send);
  sendRef.current = conversation.send;

  // The orb lives in its own window, so it is told what to render.
  useEffect(() => {
    void emit("companion:state", {
      isThinking: conversation.isThinking,
      hasSuggestion: suggestion !== null,
    });
  }, [conversation.isThinking, suggestion]);

  // Whatever the orb heard after the wake phrase is answered here.
  useEffect(() => {
    const stop = listen<{ text: string }>("companion:utterance", (event) => {
      void sendRef.current(event.payload.text);
    });
    return () => void stop.then((unlisten) => unlisten());
  }, []);

  async function handleVoiceClick() {
    if (recorder.state === "idle") {
      await recorder.start();
      return;
    }

    if (recorder.state !== "recording") return;

    const audio = await recorder.stop();
    try {
      if (!audio) return;
      const transcript = await transcribe(audio);
      if (transcript.trim()) chatBoxRef.current?.insertText(transcript);
    } catch (error) {
      console.error("Transcription failed:", error);
    } finally {
      recorder.reset();
    }
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0d0d11] text-zinc-100">
      <nav className="flex w-52 shrink-0 flex-col border-r border-white/[0.06] bg-[#111116] p-3">
        <div className="mb-5 flex items-center gap-2.5 px-2 pt-2">
          <div className="grid size-8 place-items-center rounded-xl border border-violet-300/15 bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10 text-violet-300">
            <span aria-hidden="true">✳</span>
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight">Companion</p>
            <p className="text-[10px] text-zinc-500">{statusLabel(status)}</p>
          </div>
        </div>

        <ul className="space-y-1">
          {SECTIONS.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setSection(item.id)}
                className={`w-full rounded-xl px-3 py-2 text-left text-xs transition ${
                  section === item.id
                    ? "bg-violet-500/15 text-violet-200"
                    : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
                }`}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={conversation.reset}
          className="mt-auto rounded-xl border border-white/[0.08] px-3 py-2 text-[11px] text-zinc-400 transition hover:bg-white/[0.05] hover:text-zinc-200"
        >
          New conversation
        </button>
      </nav>

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden p-5">
        {suggestion && section === "chat" && (
          <div className="mx-auto mb-4 w-full max-w-3xl">
            <SuggestionBubble
              text={suggestion}
              onOpen={() => {
                conversation.addAssistantNote(suggestion);
                dismiss();
              }}
              onDismiss={dismiss}
            />
          </div>
        )}

        {section === "chat" && (
          <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1">
            <ChatBox
              ref={chatBoxRef}
              messages={conversation.messages}
              isThinking={conversation.isThinking}
              onSubmit={conversation.send}
              onVoiceClick={handleVoiceClick}
              onOpenSettings={() => setSection("settings")}
              onNewConversation={conversation.reset}
              voiceState={recorder.state}
            />
          </div>
        )}

        {section === "activity" && (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ActivityLog />
          </div>
        )}

        {section === "settings" && (
          <div className="mx-auto flex min-h-0 w-full max-w-xl flex-1">
            <SettingsPanel
              preferences={preferences}
              onChange={update}
              onClose={() => setSection("chat")}
            />
          </div>
        )}
      </main>

      <PermissionDialog
        request={conversation.permission.current}
        onApprove={conversation.permission.approve}
        onReject={conversation.permission.reject}
      />
    </div>
  );
}

function statusLabel(status: OrbStatus) {
  if (status === "listening") return "Listening...";
  if (status === "thinking") return "Thinking...";
  if (status === "speaking") return "Speaking...";
  return "Ready to help";
}
