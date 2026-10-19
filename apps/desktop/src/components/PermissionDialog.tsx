
import { useEffect, useRef } from "react";

export type PermissionRisk = "low" | "medium" | "high" | "critical";

export interface PermissionRequest {
  id: string;
  action: string;
  description: string;
  reason: string;
  risk: PermissionRisk;
  target?: string;
}

interface PermissionDialogProps {
  request: PermissionRequest | null;
  onApprove: (request: PermissionRequest) => void;
  onReject: (request: PermissionRequest) => void;
  isProcessing?: boolean;
}

const riskStyles: Record<
  PermissionRisk,
  { label: string; className: string }
> = {
  low: {
    label: "Low risk",
    className: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
  },
  medium: {
    label: "Medium risk",
    className: "border-amber-400/20 bg-amber-400/10 text-amber-300",
  },
  high: {
    label: "High risk",
    className: "border-orange-400/20 bg-orange-400/10 text-orange-300",
  },
  critical: {
    label: "Critical risk",
    className: "border-red-400/20 bg-red-400/10 text-red-300",
  },
};

export default function PermissionDialog({
  request,
  onApprove,
  onReject,
  isProcessing = false,
}: PermissionDialogProps) {
  const rejectButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (request) {
      rejectButtonRef.current?.focus();
    }
  }, [request?.id]);

  useEffect(() => {
    if (!request) return;
    const activeRequest = request;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isProcessing) {
        onReject(activeRequest);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [request, isProcessing, onReject]);

  if (!request) return null;

  const risk = riskStyles[request.risk];

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/65 p-2 backdrop-blur-md">
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="permission-title"
        aria-describedby="permission-description"
        className="flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#15151b] text-zinc-100 shadow-2xl shadow-black/50"
      >
        {/* Header */}
        <header className="flex shrink-0 items-start justify-between border-b border-white/[0.07] px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-violet-300/15 bg-violet-400/10 text-violet-300">
              <svg
                viewBox="0 0 24 24"
                className="size-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 3 21 7.5v9L12 21l-9-4.5v-9L12 3Z" />
                <path d="M12 8v4m0 4h.01" />
              </svg>
            </div>

            <div>
              <h2
                id="permission-title"
                className="text-sm font-semibold tracking-tight"
              >
                Approval required
              </h2>
              <p className="mt-1 text-xs text-zinc-500">
                Your companion needs your permission
              </p>
            </div>
          </div>

          <span
            className={`rounded-full border px-2.5 py-1 text-[10px] font-medium ${risk.className}`}
          >
            {risk.label}
          </span>
        </header>

        {/* Action details */}
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
              Requested action
            </p>

            <h3 className="text-sm font-semibold text-white">
              {request.action}
            </h3>

            <p
              id="permission-description"
              className="mt-2 text-sm leading-6 text-zinc-400"
            >
              {request.description}
            </p>
          </div>

          {request.target && (
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
              <p className="mb-1 text-[10px] uppercase tracking-wider text-zinc-500">
                Target
              </p>
              <p className="max-h-28 overflow-y-auto whitespace-pre-wrap break-all text-xs leading-5 text-zinc-300">
                {request.target}
              </p>
            </div>
          )}

          <div className="rounded-xl border border-violet-400/10 bg-violet-400/[0.04] p-3.5">
            <p className="mb-1.5 text-xs font-medium text-violet-300">
              Why this action?
            </p>
            <p className="text-xs leading-5 text-zinc-400">
              {request.reason}
            </p>
          </div>

          {request.risk === "high" || request.risk === "critical" ? (
            <p className="text-xs leading-5 text-red-300/90">
              This action may have significant consequences. Review the target
              and details carefully before approving.
            </p>
          ) : null}
        </div>

        {/* Explicit decision */}
        <footer className="shrink-0 border-t border-white/[0.07] p-3">
          <div className="flex gap-2.5">
            <button
              ref={rejectButtonRef}
              type="button"
              disabled={isProcessing}
              onClick={() => onReject(request)}
              className="min-h-11 flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm font-medium text-zinc-300 transition hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Deny
            </button>

            <button
              type="button"
              disabled={isProcessing}
              onClick={() => onApprove(request)}
              className="min-h-11 flex-1 rounded-xl bg-violet-500 px-4 text-sm font-semibold text-white transition hover:bg-violet-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#15151b] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isProcessing ? "Processing..." : "Approve action"}
            </button>
          </div>

          <p className="mt-3 text-center text-[10px] text-zinc-600">
            No action should run without your explicit approval.
          </p>
        </footer>
      </section>
    </div>
  );
}
