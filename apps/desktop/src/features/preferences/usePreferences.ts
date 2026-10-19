import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { loadPreferences, savePreferences, type Preferences } from "../../services/ai";

export type { Preferences };

const DEFAULTS: Preferences = {
  autoApproveLowRisk: false,
  speakReplies: true,
  proactiveSuggestions: false,
  suggestionIntervalMinutes: 30,
  launchAtLogin: false,
  alwaysListening: true,
  wakePhrases: ["hey companion", "tell me what you think"],
};

export function usePreferences() {
  const [preferences, setPreferences] = useState<Preferences>(DEFAULTS);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    loadPreferences()
      .then((stored) => {
        setPreferences(stored);
        return invoke("set_autostart", { enabled: stored.launchAtLogin });
      })
      .catch((error) => console.error("Could not load preferences:", error))
      .finally(() => setIsLoaded(true));
  }, []);

  const update = useCallback(async (patch: Partial<Preferences>) => {
    setPreferences((prev) => ({ ...prev, ...patch }));

    try {
      const saved = await savePreferences(patch);
      setPreferences(saved);

      if (patch.launchAtLogin !== undefined) {
        await invoke("set_autostart", { enabled: patch.launchAtLogin });
      }
    } catch (error) {
      console.error("Could not save preferences:", error);
    }
  }, []);

  return { preferences, update, isLoaded };
}
