import { Router } from "express";
import { callDeepSeek, parseArguments, systemPrompt, type ChatMessage } from "../deepseek";
import { addMessage } from "../memory";
import { TOOLS } from "../tools";

export const chatRouter = Router();

chatRouter.get("/tools", (_req, res) => {
    res.json({ tools: TOOLS });
});

chatRouter.post("/chat", async (req, res) => {
    const {
        history,
        conversationId,
        enableTools = true,
    } = req.body as {
        history: ChatMessage[];
        conversationId?: string;
        enableTools?: boolean;
    };

    try {
        const message = await callDeepSeek(
            [{ role: "system", content: await systemPrompt() }, ...history],
            enableTools,
        );

        if (conversationId) {
            const lastTurn = history[history.length - 1];
            if (lastTurn?.role === "user" && typeof lastTurn.content === "string") {
                await addMessage(conversationId, "user", lastTurn.content);
            }
            if (message.content) {
                await addMessage(conversationId, "assistant", message.content);
            }
        }

        res.json({
            reply: message.content ?? "",
            assistantMessage: message,
            toolCalls: (message.tool_calls ?? []).map((call) => ({
                id: call.id,
                name: call.function.name,
                input: parseArguments(call.function.arguments),
            })),
        });
    } catch (error) {
        res.status(500).json({ error: String(error) });
    }
});

chatRouter.post("/suggest", async (req, res) => {
    const { activeWindow, localTime } = req.body as {
        activeWindow?: { app?: string; title?: string };
        localTime?: string;
    };

    try {
        const context = [
            localTime ? `Local time: ${localTime}.` : null,
            activeWindow?.app || activeWindow?.title
                ? `Focused window: ${activeWindow.app ?? ""} ${activeWindow.title ?? ""}`.trim()
                : null,
        ]
            .filter(Boolean)
            .join(" ");

        const message = await callDeepSeek(
            [
                {
                    role: "system",
                    content: [
                        await systemPrompt(),
                        "You are deciding whether to proactively say one short thing to the user, unprompted.",
                        "Reply with a single sentence of at most 14 words, or exactly NONE if nothing is worth interrupting for.",
                        "Prefer NONE. Never invent activity you cannot see in the context.",
                    ].join("\n"),
                },
                { role: "user", content: context || "No desktop context available." },
            ],
            false,
        );

        const text = (message.content ?? "").trim();
        res.json({ suggestion: text === "NONE" || text === "" ? null : text });
    } catch (error) {
        res.status(500).json({ error: String(error) });
    }
});
