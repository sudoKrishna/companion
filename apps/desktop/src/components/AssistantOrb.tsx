
import { ThinkingOrb } from "thinking-orbs";

export type OrbStatus =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking";

interface AssistantOrbProps {
  status: OrbStatus;
  onClick: () => void;
}

export default function AssistantOrb({
  status,
  onClick,
}: AssistantOrbProps) {
  const orbState = {
    idle: "breathing",
    listening: "listening",
    thinking: "searching",
    speaking: "working",
  }[status] as
    | "breathing"
    | "listening"
    | "searching"
    | "working";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open AI companion"
      title="Open AI companion"
      className="relative grid size-[72px] shrink-0 place-items-center rounded-full bg-transparent p-1 outline-none transition-transform duration-200 hover:scale-105 focus-visible:ring-2 focus-visible:ring-violet-400"
    >
      <ThinkingOrb state={orbState} size={64} />

      <span
        className={`absolute bottom-1 right-1 size-2.5 rounded-full border-2 border-[#111116] ${
          status === "listening"
            ? "bg-red-500"
            : status === "thinking"
              ? "bg-amber-400"
              : status === "speaking"
                ? "bg-emerald-400"
                : "bg-zinc-500"
        }`}
      />
    </button>
  );
}
