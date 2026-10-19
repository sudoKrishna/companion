import { Router } from "express";
import {
    addFact,
    deleteFact,
    listConversations,
    listFacts,
    listMessages,
    listToolAudit,
    recordToolDecision,
} from "../memory";

export const memoryRouter = Router();

memoryRouter.get("/memory/facts", async (_req, res) => {
    res.json({ facts: await listFacts() });
});

memoryRouter.post("/memory/facts", async (req, res) => {
    const { content } = req.body as { content: string };

    if (!content?.trim()) {
        res.status(400).json({ error: "content is required" });
        return;
    }

    res.json({ fact: await addFact(content) });
});

memoryRouter.delete("/memory/facts/:id", async (req, res) => {
    res.json({ deleted: await deleteFact(req.params.id) });
});

memoryRouter.get("/conversations", async (_req, res) => {
    res.json({ conversations: await listConversations() });
});

memoryRouter.get("/conversations/:id/messages", async (req, res) => {
    res.json({ messages: await listMessages(req.params.id) });
});

memoryRouter.post("/audit/tool", async (req, res) => {
    const { toolName, input, decision } = req.body as {
        toolName: string;
        input: unknown;
        decision: string;
    };

    await recordToolDecision(toolName, input, decision);
    res.json({ ok: true });
});

memoryRouter.get("/audit/tool", async (_req, res) => {
    res.json({ entries: await listToolAudit() });
});
