import { useEffect, useState } from "react";
import { listToolAudit, type AuditEntry } from "../services/ai";

const decisionStyles: Record<string, string> = {
  approved: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
  auto_approved: "border-sky-400/20 bg-sky-400/10 text-sky-300",
  rejected: "border-red-400/20 bg-red-400/10 text-red-300",
};

export default function ActivityLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listToolAudit()
      .then(setEntries)
      .catch((cause) => setError(String(cause)));
  }, []);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="mb-5">
        <h1 className="text-lg font-semibold tracking-tight text-white">Activity</h1>
        <p className="mt-1 text-xs text-zinc-500">
          Every action your companion asked to take, and what you decided.
        </p>
      </header>

      {error && <p className="text-xs text-red-300">{error}</p>}

      {!error && entries.length === 0 && (
        <p className="text-xs text-zinc-500">No actions have been requested yet.</p>
      )}

      <ul className="space-y-2">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-xs text-zinc-200">{entry.toolName}</span>

              <span className="flex items-center gap-2">
                <time className="text-[10px] text-zinc-600">
                  {new Date(entry.createdAt).toLocaleString()}
                </time>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] ${
                    decisionStyles[entry.decision] ??
                    "border-white/10 bg-white/[0.04] text-zinc-400"
                  }`}
                >
                  {entry.decision.replace("_", " ")}
                </span>
              </span>
            </div>

            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all text-[10px] leading-4 text-zinc-500">
              {entry.input}
            </pre>
          </li>
        ))}
      </ul>
    </div>
  );
}
