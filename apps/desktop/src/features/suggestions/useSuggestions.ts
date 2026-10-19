import { useEffect, useState } from "react";
import { fetchSuggestion } from "../../services/ai";
import { executeTool } from "../../services/tools";
import type { Preferences } from "../preferences/usePreferences";

export function useSuggestions(preferences: Preferences, isBusy: boolean) {
  const [suggestion, setSuggestion] = useState<string | null>(null);

  useEffect(() => {
    if (!preferences.proactiveSuggestions) {
      setSuggestion(null);
      return;
    }

    let cancelled = false;

    async function tick() {
      if (cancelled || isBusy) return;

      try {
        const window = preferences.autoApproveLowRisk
          ? await executeTool("active_window", {}).catch(() => null)
          : null;

        const text = await fetchSuggestion({
          activeWindow: window ? { title: window.text } : undefined,
          localTime: new Date().toLocaleTimeString(),
        });

        if (!cancelled && text) setSuggestion(text);
      } catch (error) {
        console.error("Suggestion check failed:", error);
      }
    }

    const intervalMs = Math.max(1, preferences.suggestionIntervalMinutes) * 60_000;
    const timer = setInterval(tick, intervalMs);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [
    preferences.proactiveSuggestions,
    preferences.suggestionIntervalMinutes,
    preferences.autoApproveLowRisk,
    isBusy,
  ]);

  return { suggestion, dismiss: () => setSuggestion(null) };
}
