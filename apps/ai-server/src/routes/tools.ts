import { Router } from "express";
import { runTool } from "../executor";

export const toolsRouter = Router();

const APP_TOKEN = process.env.COMPANION_TOKEN;

toolsRouter.use((req, res, next) => {
    if (APP_TOKEN && req.header("x-companion-token") !== APP_TOKEN) {
        res.status(403).json({ error: "forbidden: missing or wrong app token" });
        return;
    }
    next();
});

toolsRouter.post("/", async (req, res) => {
    const { name, input } = req.body as { name: string; input?: Record<string, unknown> };

    try {
        res.json(await runTool(name, input ?? {}));
    } catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    }
});
