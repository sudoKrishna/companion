interface SuggestionBubbleProps {
  text: string;
  onOpen: () => void;
  onDismiss: () => void;
}

export default function SuggestionBubble({
  text,
  onOpen,
  onDismiss,
}: SuggestionBubbleProps) {
  return (
    <div className="pointer-events-auto flex max-w-[260px] items-start gap-2 rounded-2xl border border-violet-400/20 bg-[#15151b]/95 p-3 shadow-xl shadow-black/40 backdrop-blur">
      <button
        type="button"
        onClick={onOpen}
        className="flex-1 text-left text-[11px] leading-4 text-zinc-200"
      >
        {text}
      </button>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss suggestion"
        className="grid size-5 shrink-0 place-items-center rounded-lg text-zinc-500 transition hover:bg-white/[0.07] hover:text-zinc-200"
      >
        <svg
          viewBox="0 0 24 24"
          className="size-3"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          aria-hidden="true"
        >
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
