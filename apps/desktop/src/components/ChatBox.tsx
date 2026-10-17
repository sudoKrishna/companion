
import {
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
}

interface ChatBoxProps {
  messages: ChatMessage[];
  onSubmit: (message: string) => void | Promise<void>;
  onVoiceClick?: () => void;
  isThinking?: boolean;
  placeholder?: string;
}

export default function ChatBox({
  messages,
  onSubmit,
  onVoiceClick,
  isThinking = false,
  placeholder = "Message your companion...",
}: ChatBoxProps) {
  const [value, setValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function handleSubmit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    const message = value.trim();

    if (!message || isSubmitting || isThinking) return;

    setIsSubmitting(true);
    setValue("");

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      await onSubmit(message);
    } catch (error) {
      console.error("Failed to send message:", error);
      setValue(message);
    } finally {
      setIsSubmitting(false);
      textareaRef.current?.focus();
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void handleSubmit();
    }
  }

  function handleInput(value: string) {
    setValue(value);

    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  }

  return (
    <section className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-3xl border border-white/[0.08] bg-[#111116] text-zinc-100 shadow-2xl shadow-black/30">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between border-b border-white/[0.07] px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="relative grid size-9 place-items-center rounded-xl border border-violet-300/15 bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10">
            <svg
              viewBox="0 0 24 24"
              className="size-5 text-violet-300"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              aria-hidden="true"
            >
              <path d="m12 2 2.7 7.3L22 12l-7.3 2.7L12 22l-2.7-7.3L2 12l7.3-2.7L12 2Z" />
            </svg>
          </div>

          <div>
            <h2 className="text-sm font-semibold tracking-tight">
              Companion
            </h2>
            <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-zinc-500">
              <span
                className={`size-1.5 rounded-full ${
                  isThinking
                    ? "animate-pulse bg-amber-400"
                    : "bg-emerald-400"
                }`}
              />
              {isThinking ? "Thinking..." : "Ready to help"}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setValue("");
            textareaRef.current?.focus();
          }}
          className="grid size-8 place-items-center rounded-xl text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-200"
          aria-label="Focus message input"
          title="New message"
        >
          <svg
            viewBox="0 0 24 24"
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            aria-hidden="true"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </header>

      {/* Conversation */}
      <div
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-4 py-5"
        aria-live="polite"
        aria-relevant="additions"
      >
        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-3 py-8 text-center">
            <div className="mb-4 grid size-14 place-items-center rounded-2xl border border-white/[0.08] bg-white/[0.03]">
              <svg
                viewBox="0 0 24 24"
                className="size-7 text-violet-300"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                aria-hidden="true"
              >
                <path d="m12 2 2.7 7.3L22 12l-7.3 2.7L12 22l-2.7-7.3L2 12l7.3-2.7L12 2Z" />
              </svg>
            </div>

            <h3 className="text-sm font-medium text-zinc-200">
              What can I help with?
            </h3>
            <p className="mt-2 max-w-[230px] text-xs leading-5 text-zinc-500">
              Ask a question, think through an idea, or get help with your work.
            </p>

            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {["Explain some code", "Help me focus", "Brainstorm an idea"].map(
                (suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setValue(suggestion)}
                    className="rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-2 text-[11px] text-zinc-400 transition hover:border-violet-400/30 hover:bg-violet-400/[0.06] hover:text-zinc-200"
                  >
                    {suggestion}
                  </button>
                ),
              )}
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <article
              key={message.id}
              className={`flex w-full gap-2.5 ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {message.role === "assistant" && (
                <div className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border border-violet-300/10 bg-violet-400/[0.08] text-violet-300">
                  <span className="text-sm" aria-hidden="true">✳</span>
                </div>
              )}

              <div
                className={`max-w-[85%] whitespace-pre-wrap break-words text-[13px] leading-6 ${
                  message.role === "user"
                    ? "rounded-2xl rounded-br-md bg-violet-500 px-3.5 py-2.5 text-white"
                    : "pt-1 text-zinc-300"
                }`}
              >
                {message.content}
                <time className="mt-1 block text-[10px] opacity-40">
                  {message.createdAt.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </div>
            </article>
          ))
        )}

        {isThinking && (
          <div className="flex items-center gap-2.5" role="status">
            <div className="grid size-7 shrink-0 place-items-center rounded-lg bg-violet-400/[0.08] text-violet-300">
              ✳
            </div>
            <div className="flex items-center gap-1 rounded-xl bg-white/[0.04] px-3 py-3">
              <span className="size-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.2s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.1s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-zinc-400" />
            </div>
            <span className="sr-only">Assistant is thinking</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="shrink-0 px-3 pb-3">
        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="rounded-2xl border border-white/[0.09] bg-[#1a1a21] transition focus-within:border-violet-400/35 focus-within:ring-2 focus-within:ring-violet-500/[0.08]"
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => handleInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            maxLength={10000}
            aria-label="Message your companion"
            className="block max-h-[120px] min-h-[42px] w-full resize-none bg-transparent px-3.5 pb-1 pt-3 text-[13px] leading-5 text-zinc-100 outline-none placeholder:text-zinc-600"
          />

          <div className="flex items-center justify-between px-2 pb-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onVoiceClick}
                disabled={!onVoiceClick}
                aria-label="Voice input"
                title={onVoiceClick ? "Voice input" : "Voice input not connected yet"}
                className="grid size-8 place-items-center rounded-xl text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="size-[17px]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="9" y="3" width="6" height="12" rx="3" />
                  <path d="M5 11a7 7 0 0 0 14 0M12 18v3m-4 0h8" />
                </svg>
              </button>

              <span className="pl-1 text-[10px] text-zinc-600">
                Enter to send · Shift + Enter for newline
              </span>
            </div>

            <button
              type="submit"
              disabled={!value.trim() || isSubmitting || isThinking}
              aria-label="Send message"
              className="grid size-8 place-items-center rounded-xl bg-violet-500 text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:bg-white/[0.06] disabled:text-zinc-600"
            >
              {isSubmitting ? (
                <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  className="size-[17px]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 19V5m-7 7 7-7 7 7" />
                </svg>
              )}
            </button>
          </div>
        </form>

        <p className="mt-2 text-center text-[10px] text-zinc-600">
          Your companion · Always here when you need it
        </p>
      </div>
    </section>
  );
}
