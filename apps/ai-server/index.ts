import express from "express";

const app = express();
const PORT = 4000;

app.use(express.json());

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
        res.sendStatus(200);
        return;
    }
    next();
});

interface ChatMessage {
    role: string;
    content: string;
}

app.post("/chat", async (req, res, next) => {
    const { history } = req.body as { history: ChatMessage[] };

    const deRes = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
            model: "deepseek-chat",
            messages: history,
            stream: false,
        }),
    });

    if (!deRes.ok) {
        const text = await deRes.text();
        res.status(500).json({ error: `DeepSeek error (${deRes.status}) : ${text}` });
        return;
    }

    const data = await deRes.json();
    const reply = data.choices?.[0]?.message?.content ?? "";
    res.json({ reply });
});

app.post("/transcribe", async (req, res, next) => {
    const { audioBase64 } = req.body as { audioBase64: string };
    const apiKey = process.env.ASSEMBLYAI_API_KEY!;

    try {
        const audioBuffer = Buffer.from(audioBase64, "base64");
        const uploadRes = await fetch("https://api.assemblyai.com/v2/upload", {
            method: "POST",
            headers: { Authorization: apiKey },
            body: audioBuffer,
        });

        if (!uploadRes.ok) {
            const text = await uploadRes.text();
            res.status(500).json({ error: `Upload failed (${uploadRes.status}) : ${text}` });
            return;
        }

        const { upload_url } = await uploadRes.json();

        const transcriptRes = await fetch("https://api.assemblyai.com/v2/transcript", {
            method: "POST",
            headers: {
                Authorization: apiKey,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ audio_url: upload_url }),
        });

        const { id } = await transcriptRes.json();

        let transcriptText = "";
        for (let i = 0; i < 30; i++) {
            await new Promise((r) => setTimeout(r, 1000));

            const pollRes = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
                headers: { Authorization: apiKey },
            });

            const poll = await pollRes.json();

            if (poll.status === "completed") {
                transcriptText = poll.text ?? "";
                break;
            }

            if (poll.status === "error") {
                res.status(500).json({ error: `AssemblyAI error : ${poll.error}` });
                return;
            }
        }

        res.json({ transcript: transcriptText });
    } catch (error) {
        res.status(500).json({ error: String(error) });
    }
});

app.listen(PORT, () => {
    console.log(`Ai server is running on ${PORT}`);
});
