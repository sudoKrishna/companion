import { db } from "./db";

export interface Preferences {
    autoApproveLowRisk: boolean;
    speakReplies: boolean;
    proactiveSuggestions: boolean;
    suggestionIntervalMinutes: number;
    launchAtLogin: boolean;
    alwaysListening: boolean;
    wakePhrases: string[];
}

const DEFAULTS: Preferences = {
    autoApproveLowRisk: false,
    speakReplies: true,
    proactiveSuggestions: false,
    suggestionIntervalMinutes: 30,
    launchAtLogin: false,
    alwaysListening: true,
    wakePhrases: ["hey companion", "tell me what you think"],
};

export async function loadPreferences(): Promise<Preferences> {
    const row = await db.preference.findUnique({ where: { id: 1 } });
    if (!row) return { ...DEFAULTS };
    return { ...DEFAULTS, ...(row.value as Partial<Preferences>) };
}

export async function savePreferences(patch: Partial<Preferences>): Promise<Preferences> {
    const next = { ...(await loadPreferences()), ...patch };

    await db.preference.upsert({
        where: { id: 1 },
        create: { id: 1, value: next },
        update: { value: next },
    });

    return next;
}
