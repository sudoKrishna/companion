import { useEffect, useState } from "react";
import { deleteFact, listFacts, type Fact } from "../services/ai";
import type { Preferences } from "../features/preferences/usePreferences";

interface SettingsPanelProps {
  preferences: Preferences;
  onChange: (patch: Partial<Preferences>) => void;
  onClose: () => void;
}

export default function SettingsPanel({
  preferences,
  onChange,
  onClose,
}: SettingsPanelProps) {
  const [facts, setFacts] = useState<Fact[]>([]);

  useEffect(() => {
    listFacts()
      .then(setFacts)
      .catch((error) => console.error("Could not load memory:", error));
  }, []);

  async function forget(id: string) {
    try {
      await deleteFact(id);
      setFacts((prev) => prev.filter((fact) => fact.id !== id));
    } catch (error) {
      console.error("Could not forget fact:", error);
    }
  }

  return (
    <section className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-3xl border border-white/[0.08] bg-[#111116] text-zinc-100 shadow-2xl shadow-black/30">
      <header className="flex shrink-0 items-center justify-between border-b border-white/[0.07] px-4 py-3">
        <h2 className="text-sm font-semibold tracking-tight">Settings</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close settings"
          className="grid size-8 place-items-center rounded-xl text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-200"
        >
          <svg
            viewBox="0 0 24 24"
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-4">
        <div className="space-y-1">
          <Toggle
            label="Speak replies out loud"
            hint="Uses ElevenLabs text to speech."
            checked={preferences.speakReplies}
            onChange={(speakReplies) => onChange({ speakReplies })}
          />
          <Toggle
            label="Always listening"
            hint="Keeps the mic open. Only speech is uploaded, and only when it starts with a wake phrase."
            checked={preferences.alwaysListening}
            onChange={(alwaysListening) => onChange({ alwaysListening })}
          />
          <Toggle
            label="Auto-approve low risk actions"
            hint="Reading folders, checking the window, and memory still skip the dialog."
            checked={preferences.autoApproveLowRisk}
            onChange={(autoApproveLowRisk) => onChange({ autoApproveLowRisk })}
          />
          <Toggle
            label="Proactive suggestions"
            hint="Occasionally offers one short thought without being asked."
            checked={preferences.proactiveSuggestions}
            onChange={(proactiveSuggestions) => onChange({ proactiveSuggestions })}
          />
          <Toggle
            label="Launch at login"
            hint="Starts the companion when you log in."
            checked={preferences.launchAtLogin}
            onChange={(launchAtLogin) => onChange({ launchAtLogin })}
          />
        </div>

        {preferences.alwaysListening && (
          <label className="block">
            <span className="text-xs text-zinc-300">Wake phrases</span>
            <span className="mt-0.5 block text-[11px] leading-4 text-zinc-500">
              One per line. Anything you say after a phrase becomes the request.
            </span>
            <textarea
              defaultValue={preferences.wakePhrases.join("\n")}
              onBlur={(event) =>
                onChange({
                  wakePhrases: event.target.value
                    .split("\n")
                    .map((phrase) => phrase.trim())
                    .filter(Boolean),
                })
              }
              rows={3}
              className="mt-2 w-full resize-none rounded-xl border border-white/[0.09] bg-[#1a1a21] px-3 py-2 text-xs leading-5 text-zinc-200 outline-none focus:border-violet-400/40"
            />
          </label>
        )}

        {preferences.proactiveSuggestions && (
          <label className="block">
            <span className="text-xs text-zinc-300">Suggestion interval</span>
            <select
              value={preferences.suggestionIntervalMinutes}
              onChange={(event) =>
                onChange({ suggestionIntervalMinutes: Number(event.target.value) })
              }
              className="mt-2 w-full rounded-xl border border-white/[0.09] bg-[#1a1a21] px-3 py-2 text-xs text-zinc-200 outline-none focus:border-violet-400/40"
            >
              {[5, 15, 30, 60].map((minutes) => (
                <option key={minutes} value={minutes}>
                  Every {minutes} minutes
                </option>
              ))}
            </select>
          </label>
        )}

        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
            Memory ({facts.length})
          </p>

          {facts.length === 0 ? (
            <p className="text-xs leading-5 text-zinc-500">
              Nothing remembered yet. Tell your companion something durable and it will
              store it here.
            </p>
          ) : (
            <ul className="space-y-2">
              {facts.map((fact) => (
                <li
                  key={fact.id}
                  className="flex items-start justify-between gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3"
                >
                  <span className="text-xs leading-5 text-zinc-300">{fact.content}</span>
                  <button
                    type="button"
                    onClick={() => void forget(fact.id)}
                    className="shrink-0 rounded-lg px-2 py-1 text-[10px] text-zinc-500 transition hover:bg-white/[0.06] hover:text-red-300"
                  >
                    Forget
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

interface ToggleProps {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}

function Toggle({ label, hint, checked, onChange }: ToggleProps) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3 rounded-xl px-1 py-2.5 transition hover:bg-white/[0.02]">
      <span>
        <span className="block text-xs text-zinc-200">{label}</span>
        <span className="mt-0.5 block text-[11px] leading-4 text-zinc-500">{hint}</span>
      </span>

      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="sr-only"
      />

      <span
        aria-hidden="true"
        className={`mt-0.5 grid h-5 w-9 shrink-0 place-items-center rounded-full border transition ${
          checked
            ? "border-violet-400/40 bg-violet-500/80"
            : "border-white/10 bg-white/[0.06]"
        }`}
      >
        <span
          className={`block size-3.5 rounded-full bg-white transition-transform ${
            checked ? "translate-x-[8px]" : "translate-x-[-8px]"
          }`}
        />
      </span>
    </label>
  );
}
