import { useCallback, useRef, useState } from "react";
import type { PermissionRequest } from "../../components/PermissionDialog";
import type { RequestedTool, ToolSpec } from "../../services/ai";
import { describeToolTarget } from "../../services/tools";

export type Decision = "approved" | "rejected";

interface Pending {
  request: PermissionRequest;
  resolve: (decision: Decision) => void;
}

export function usePermissionGate() {
  const [current, setCurrent] = useState<PermissionRequest | null>(null);
  const pending = useRef<Pending | null>(null);

  const requestApproval = useCallback(
    (spec: ToolSpec, call: RequestedTool, reason: string): Promise<Decision> => {
      const request: PermissionRequest = {
        id: call.id,
        action: spec.title,
        description: spec.description,
        reason,
        risk: spec.risk,
        target: describeToolTarget(call.name, call.input),
      };

      return new Promise<Decision>((resolve) => {
        pending.current = { request, resolve };
        setCurrent(request);
      });
    },
    [],
  );

  const decide = useCallback((decision: Decision) => {
    const active = pending.current;
    pending.current = null;
    setCurrent(null);
    active?.resolve(decision);
  }, []);

  const approve = useCallback(() => decide("approved"), [decide]);
  const reject = useCallback(() => decide("rejected"), [decide]);

  return { current, requestApproval, approve, reject };
}
