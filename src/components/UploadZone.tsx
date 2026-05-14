"use client";

import { useRef, useState } from "react";

interface UploadZoneProps {
  busy: boolean;
  onFileSelected: (file: File) => Promise<void> | void;
  onTryDemo: () => void;
}

export function UploadZone({ busy, onFileSelected, onTryDemo }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  async function acceptFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) {
      return;
    }

    await onFileSelected(file);
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/30">
      <div
        className={`rounded-2xl border border-dashed p-8 text-center transition ${
          isDragging
            ? "border-cyan-400 bg-cyan-400/10"
            : "border-slate-700 bg-slate-950/60"
        }`}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          void acceptFiles(event.dataTransfer.files);
        }}
      >
        <p className="text-sm font-semibold uppercase tracking-[0.32em] text-cyan-200">
          Upload radiograph
        </p>
        <h2 className="mt-3 text-2xl font-semibold text-white">
          Drag a panoramic, bitewing, or periapical image here
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          DentalMentor AI will cache repeat uploads, call ThakaaMed only when needed,
          and prepare a narrated mentor session.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="inline-flex min-w-40 items-center justify-center rounded-full bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
          >
            {busy ? "Working..." : "Choose image"}
          </button>
          <button
            type="button"
            onClick={onTryDemo}
            disabled={busy}
            className="inline-flex min-w-40 items-center justify-center rounded-full border border-slate-600 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-cyan-300 hover:text-cyan-100 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-500"
          >
            Try demo
          </button>
        </div>
      </div>

      <ul className="mt-5 grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
        <li className="rounded-2xl border border-white/5 bg-slate-950/50 p-4">Canvas zooms to each tooth before narration starts.</li>
        <li className="rounded-2xl border border-white/5 bg-slate-950/50 p-4">Voice uses the browser&apos;s built-in Web Speech API, so there is no extra TTS dependency.</li>
        <li className="rounded-2xl border border-white/5 bg-slate-950/50 p-4">Demo mode runs without ThakaaMed or Claude keys.</li>
      </ul>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          void acceptFiles(event.target.files);
          event.currentTarget.value = "";
        }}
      />
    </section>
  );
}
