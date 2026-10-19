import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage } from "../../components/ChatBox";
import {
  fetchTools,
  recordToolDecision,
  sendChat,
  type ApiMessage,
  type RequestedTool,
  type ToolSpec,
} from "../../services/ai";
import { executeTool } from "../../services/tools";
import { usePermissionGate } from "../permissions/usePermissionGate";
import type { Preferences } from "../preferences/usePreferences";

const MAX_TOOL_ROUNDS = 5;

interface ConversationOptions {
  /** Called with each final reply. The orb window turns this into speech. */
  onReply?: (text: string) => void;
}

export function useConversation(preferences: Preferences, options: ConversationOptions = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [toolSpecs, setToolSpecs] = useState<Map<string, ToolSpec>>(new Map());
  const apiHistory = useRef<ApiMessage[]>([]);
  const conversationId = useRef(crypto.randomUUID());
  const gate = usePermissionGate();
  const prefs = useRef(preferences);
  prefs.current = preferences;

  useEffect(() => {
    fetchTools()
      .then((tools) => setToolSpecs(new Map(tools.map((tool) => [tool.name, tool]))))
      .catch((error) => console.error("Could not load tool registry:", error));
  }, []);

  const append = useCallback((message: Omit<ChatMessage, "id" | "createdAt">) => {
    setMessages((prev) => [
      ...prev,
      { ...message, id: crypto.randomUUID(), createdAt: new Date() },
    ]);
  }, []);

  const onReply = useRef(options.onReply);
  onReply.current = options.onReply;

  const emitReply = useCallback((text: string) => {
    if (text.trim()) onReply.current?.(text);
  }, []);

  const runToolCall = useCallback(
    async (call: RequestedTool, reason: string): Promise<ApiMessage> => {
      const spec = toolSpecs.get(call.name);

      if (!spec) {
        return {
          role: "tool",
          tool_call_id: call.id,
          content: `Tool "${call.name}" is not available on this machine.`,
        };
      }

      const autoApproved = prefs.current.autoApproveLowRisk && spec.risk === "low";
      const decision = autoApproved ? "approved" : await gate.requestApproval(spec, call, reason);

      void recordToolDecision(
        call.name,
        call.input,
        autoApproved ? "auto_approved" : decision,
      ).catch(() => undefined);

      if (decision === "rejected") {
        append({
          role: "tool",
          content: `Denied: ${spec.title}`,
          toolName: call.name,
        });

        return {
          role: "tool",
          tool_call_id: call.id,
          content:
            "The user denied permission for this action. Do not retry it; continue without it or ask them what to do instead.",
        };
      }

      try {
        const result = await executeTool(call.name, call.input);

        append({
          role: "tool",
          content: `${spec.title}${autoApproved ? " (auto-approved)" : ""}`,
          toolName: call.name,
          toolOutput: result.text,
          imageBase64: result.imageBase64,
        });

        return { role: "tool", tool_call_id: call.id, content: result.text };
      } catch (error) {
        const message = String(error);

        append({
          role: "tool",
          content: `${spec.title} failed`,
          toolName: call.name,
          toolOutput: message,
        });

        return { role: "tool", tool_call_id: call.id, content: `Tool failed: ${message}` };
      }
    },
    [append, gate, toolSpecs],
  );

  const send = useCallback(
    async (content: string) => {
      append({ role: "user", content });
      apiHistory.current.push({ role: "user", content });
      setIsThinking(true);

      try {
        for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
          const response = await sendChat(apiHistory.current, conversationId.current);

          apiHistory.current.push(response.assistantMessage);

          if (response.reply.trim()) {
            append({ role: "assistant", content: response.reply });
          }

          if (response.toolCalls.length === 0) {
            emitReply(response.reply);
            return;
          }

          if (round === MAX_TOOL_ROUNDS) {
            append({
              role: "assistant",
              content: "I stopped after too many tool steps. Tell me how you want to continue.",
            });
            return;
          }

          const reason = response.reply.trim() || "The assistant requested this to answer you.";

          for (const call of response.toolCalls) {
            apiHistory.current.push(await runToolCall(call, reason));
          }
        }
      } catch (error) {
        append({ role: "assistant", content: `Error: ${String(error)}` });
      } finally {
        setIsThinking(false);
      }
    },
    [append, emitReply, runToolCall],
  );

  const addAssistantNote = useCallback(
    (content: string) => {
      append({ role: "assistant", content });
      apiHistory.current.push({ role: "assistant", content });
    },
    [append],
  );

  const reset = useCallback(() => {
    apiHistory.current = [];
    conversationId.current = crypto.randomUUID();
    setMessages([]);
  }, []);

  return {
    messages,
    isThinking,
    send,
    reset,
    addAssistantNote,
    permission: gate,
  };
}
