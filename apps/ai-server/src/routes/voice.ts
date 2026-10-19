import { Router } from "express";

export const voiceRouter = Router();

// Sarah: usable on the free plan. Library voices such as Rachel return 402 there.
const DEFAULT_VOICE_ID = process.env.ELEVENLABS_VOICE_ID ?? "EXAVITQu4vr4xnSDxMaL";
const POLL_ATTEMPTS = 30;

voiceRouter.post("/transcribe", async (req, res) => {
    const { audioBase64 } = req.body as { audioBase64: string };
    const apiKey = process.env.ASSEMBLYAI_API_KEY!;

    try {
        const uploadRes = await fetch("https://api.assemblyai.com/v2/upload", {
            method: "POST",
            headers: { Authorization: apiKey },
            body: Buffer.from(audioBase64, "base64"),
        });

        if (!uploadRes.ok) {
            const text = await uploadRes.text();
            res.status(500).json({ error: `Upload failed (${uploadRes.status}) : ${text}` });
            return;
        }

        const { upload_url } = (await uploadRes.json()) as { upload_url: string };

        const transcriptRes = await fetch("https://api.assemblyai.com/v2/transcript", {
            method: "POST",
            headers: { Authorization: apiKey, "Content-Type": "application/json" },
            body: JSON.stringify({ audio_url: upload_url }),
        });

        const { id } = (await transcriptRes.json()) as { id: string };

        for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
            await new Promise((resolve) => setTimeout(resolve, 1000));

            const pollRes = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
                headers: { Authorization: apiKey },
            });

            const poll = (await pollRes.json()) as {
                status: string;
                text?: string;
                error?: string;
            };

            if (poll.status === "completed") {
                res.json({ transcript: poll.text ?? "" });
                return;
            }

            if (poll.status === "error") {
                res.status(500).json({ error: `AssemblyAI error : ${poll.error}` });
                return;
            }
        }

        res.status(504).json({ error: "Transcription timed out" });
    } catch (error) {
        res.status(500).json({ error: String(error) });
    }
});

voiceRouter.post("/speak", async (req, res) => {
    const { text, voiceId } = req.body as { text: string; voiceId?: string };
    const apiKey = process.env.ELEVENLABS_API_KEY!;

    if (!text?.trim()) {
        res.status(400).json({ error: "text is required" });
        return;
    }

    try {
        const voice = voiceId ?? DEFAULT_VOICE_ID;
        const ttsRes = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`,
            {
                method: "POST",
                headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
                body: JSON.stringify({ text, model_id: "eleven_multilingual_v2" }),
            },
        );

        if (!ttsRes.ok) {
            const detail = await ttsRes.text();
            res.status(500).json({ error: `ElevenLabs error (${ttsRes.status}) : ${detail}` });
            return;
        }

        res.setHeader("Content-Type", "audio/mpeg");
        res.send(Buffer.from(await ttsRes.arrayBuffer()));
    } catch (error) {
        res.status(500).json({ error: String(error) });
    }
});
