import { listFacts } from "./memory";
import { toOpenAITools } from "./tools";

export interface ToolCall {
    id: string;
    type: "function";
    function: { name: string; arguments: string };
}

export interface ChatMessage {
    role: "system" | "user" | "assistant" | "tool";
    content: string | null;
    tool_calls?: ToolCall[];
    tool_call_id?: string;
}

export async function systemPrompt() {
    const facts = await listFacts(50);
    const lines = [
        "You are Companion, a voice-first desktop assistant that lives in a small floating orb on the user's screen.",
        "Keep replies short and conversational — they are often spoken aloud.",
        "You have tools that touch the user's real computer. Every tool call is shown to the user for explicit approval before it runs, so call a tool when it genuinely helps instead of guessing.",
        "If the user tells you something durable about themselves or their work, call remember_fact.",
    ];

    if (facts.length > 0) {
        lines.push(
            "What you already know about the user:",
            ...facts.map((fact) => `- ${fact.content}`),
        );
    }

    return lines.join("\n");
}

export async function callDeepSeek(messages: ChatMessage[], useTools: boolean) {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
            model: "deepseek-chat",
            messages,
            stream: false,
            ...(useTools ? { tools: toOpenAITools(), tool_choice: "auto" } : {}),
        }),
    });

    if (!res.ok) {
        throw new Error(`DeepSeek error (${res.status}) : ${await res.text()}`);
    }

    const data = (await res.json()) as { choices?: { message?: ChatMessage }[] };
    const message = data.choices?.[0]?.message;

    if (!message) throw new Error("DeepSeek returned no message");

    return message;
}

export function parseArguments(raw: string): Record<string, unknown> {
    try {
        return JSON.parse(raw || "{}");
    } catch {
        return {};
    }
}
