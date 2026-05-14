"use client";

import { LANGUAGE_META, type MentorLanguage } from "@/types/script";

interface MentorPanelProps {
  language: MentorLanguage;
  onLanguageChange: (language: MentorLanguage) => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  onStart: () => Promise<void> | void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  playbackState: "idle" | "ready" | "playing" | "paused" | "completed";
  busy: boolean;
  voicesReady: boolean;
  currentLine: string;
  sessionLabel: string;
}

const SPEED_OPTIONS = [0.7, 1, 1.3];

export function MentorPanel({
  language,
  onLanguageChange,
  speed,
  onSpeedChange,
  onStart,
  onPause,
  onResume,
  onStop,
  playbackState,
  busy,
  voicesReady,
  currentLine,
  sessionLabel,
}: MentorPanelProps) {
  const startDisabled = busy || !voicesReady || playbackState === "playing";

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/30">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-cyan-200">
            Mentor panel
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">Narrated teaching session</h2>
          <p className="mt-2 text-sm text-slate-300">{sessionLabel}</p>
        </div>
        <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-slate-300">
          {voicesReady ? "Voice ready" : "Loading voices"}
        </span>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm text-slate-300">
          <span className="block font-medium text-slate-100">Language</span>
          <select
            value={language}
            onChange={(event) => onLanguageChange(event.target.value as MentorLanguage)}
            disabled={busy || playbackState === "playing" || playbackState === "paused"}
            className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-300 disabled:cursor-not-allowed disabled:text-slate-500"
          >
            {Object.entries(LANGUAGE_META).map(([value, meta]) => (
              <option key={value} value={value}>
                {meta.label}
              </option>
            ))}
          </select>
        </label>

        <div className="space-y-2 text-sm text-slate-300">
          <span className="block font-medium text-slate-100">Speed</span>
          <div className="flex gap-2">
            {SPEED_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => onSpeedChange(option)}
                className={`flex-1 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                  speed === option
                    ? "border-cyan-300 bg-cyan-400/15 text-cyan-100"
                    : "border-white/10 bg-slate-950 text-slate-300 hover:border-slate-500"
                }`}
              >
                {option}×
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => void onStart()}
          disabled={startDisabled}
          className="rounded-full bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
        >
          {busy ? "Preparing..." : playbackState === "paused" ? "Restart" : "Start session"}
        </button>
        <button
          type="button"
          onClick={playbackState === "paused" ? onResume : onPause}
          disabled={busy || (playbackState !== "playing" && playbackState !== "paused")}
          className="rounded-full border border-white/10 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-cyan-300 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-500"
        >
          {playbackState === "paused" ? "Resume" : "Pause"}
        </button>
        <button
          type="button"
          onClick={onStop}
          disabled={playbackState === "idle" || busy}
          className="rounded-full border border-white/10 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-red-300 hover:text-red-100 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-500"
        >
          Stop
        </button>
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/70 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Current narration</p>
        <p
          dir={LANGUAGE_META[language].direction}
          className="mt-3 min-h-24 text-sm leading-7 text-slate-100"
        >
          {currentLine || "Start the mentor session to hear the guided narration."}
        </p>
      </div>
    </section>
  );
}
