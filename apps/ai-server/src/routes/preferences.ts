import { Router } from "express";
import { loadPreferences, savePreferences, type Preferences } from "../prefs";

export const preferencesRouter = Router();

preferencesRouter.get("/", async (_req, res) => {
    res.json({ preferences: await loadPreferences() });
});

preferencesRouter.put("/", async (req, res) => {
    res.json({ preferences: await savePreferences(req.body as Partial<Preferences>) });
});
