"use client";

import { LANGUAGE_META, type MentorLanguage } from "@/types/script";

interface ConversationLine {
  role: "user" | "assistant";
  text: string;
}

interface MentorPanelProps {
  language: MentorLanguage;
  onLanguageChange: (language: MentorLanguage) => void;
  busy: boolean;
  isRecording: boolean;
  message: string;
  onMessageChange: (value: string) => void;
  onSendText: () => Promise<void> | void;
  onToggleRecording: () => Promise<void> | void;
  currentLine: string;
  sessionLabel: string;
  conversation: ConversationLine[];
}

export function MentorPanel({
  language,
  onLanguageChange,
  busy,
  isRecording,
  message,
  onMessageChange,
  onSendText,
  onToggleRecording,
  currentLine,
  sessionLabel,
  conversation,
}: MentorPanelProps) {
  const submitDisabled = busy || !message.trim();

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/30">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-cyan-200">
            Active conversation
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">Voice + text mentor</h2>
          <p className="mt-2 text-sm text-slate-300">{sessionLabel}</p>
        </div>
        <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-slate-300">
          {isRecording ? "Recording..." : "Ready"}
        </span>
      </div>

      <div className="mt-6 space-y-2 text-sm text-slate-300">
        <span className="block font-medium text-slate-100">Language</span>
        <select
          value={language}
          onChange={(event) => onLanguageChange(event.target.value as MentorLanguage)}
          disabled={busy || isRecording}
          className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-300 disabled:cursor-not-allowed disabled:text-slate-500"
        >
          {Object.entries(LANGUAGE_META).map(([value, meta]) => (
            <option key={value} value={value}>
              {meta.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-5 space-y-3">
        <textarea
          value={message}
          onChange={(event) => onMessageChange(event.target.value)}
          disabled={busy || isRecording}
          placeholder="Type your question, or use record and speak..."
          rows={3}
          className="w-full resize-none rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-300 disabled:cursor-not-allowed disabled:text-slate-500"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => void onToggleRecording()}
            disabled={busy}
            className="rounded-full border border-white/10 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-red-300 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-500"
          >
            {isRecording ? "Stop recording" : "Record voice"}
          </button>
          <button
            type="button"
            onClick={() => void onSendText()}
            disabled={submitDisabled}
            className="rounded-full bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
          >
            {busy ? "Processing..." : "Send message"}
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/70 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
          Live animated transcription
        </p>
        <p
          dir={LANGUAGE_META[language].direction}
          className="mt-3 min-h-24 text-sm leading-7 text-slate-100"
        >
          {currentLine || "Send a message or record audio to start the active mentor conversation."}
        </p>
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/70 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
          Conversation transcript
        </p>
        <div className="mt-3 max-h-56 space-y-3 overflow-y-auto text-sm text-slate-200">
          {conversation.length === 0 ? (
            <p className="text-slate-400">No conversation yet.</p>
          ) : (
            conversation.slice(-10).map((line, index) => (
              <p key={`${line.role}-${index}`}>
                <span className="font-semibold text-cyan-200">
                  {line.role === "user" ? "You" : "Mentor"}:
                </span>{" "}
                {line.text}
              </p>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
