import express from "express";
import cors from "cors";
import { chatRouter } from "./routes/chat";
import { voiceRouter } from "./routes/voice";
import { toolsRouter } from "./routes/tools";
import { memoryRouter } from "./routes/memory";
import { preferencesRouter } from "./routes/preferences";
import { TOOLS } from "./tools";

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json({ limit: "50mb" }));

app.use(chatRouter);
app.use(voiceRouter);
app.use(memoryRouter);
app.use("/tools/execute", toolsRouter);
app.use("/preferences", preferencesRouter);

app.post("/diag", (req, res) => {
    console.log("[diag]", JSON.stringify(req.body));
    res.json({ ok: true });
});

app.get("/health", (_req, res) => {
    res.json({ ok: true, tools: TOOLS.length });
});

app.listen(PORT, "127.0.0.1", () => {
    console.log(`Ai server is running on 127.0.0.1:${PORT}`);
});
