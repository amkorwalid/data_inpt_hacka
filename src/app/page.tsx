"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { FindingsList } from "@/components/FindingsList";
import { MentorPanel } from "@/components/MentorPanel";
import {
  RadiographCanvas,
  type RadiographCanvasHandle,
} from "@/components/RadiographCanvas";
import { UploadZone } from "@/components/UploadZone";
import { getToothPrimaryColor } from "@/lib/canvasOps";
import { DEMO_IMAGE_SRC, DEMO_SPATIAL_CONTEXT } from "@/lib/sampleData";
import { getDemoScript } from "@/lib/sampleScript";
import { buildSpatialContext } from "@/lib/spatialContext";
import {
  analyzeWithCache,
} from "@/lib/thakaamed";
import {
  cancelSpeech,
  pauseSpeech,
  resumeSpeech,
  speakText,
  waitForVoices,
} from "@/lib/scriptPlayer";
import { LANGUAGE_META, type MentorLanguage, type ScriptEvent } from "@/types/script";
import type { SpatialContext, ThakaaMedAnalysisResponse } from "@/types/thakaamed";

function createAbortError() {
  return new DOMException("Playback aborted", "AbortError");
}

export default function HomePage() {
  const canvasRef = useRef<RadiographCanvasHandle | null>(null);
  const playbackAbortRef = useRef<AbortController | null>(null);
  const pauseResolversRef = useRef<Array<() => void>>([]);

  const [analysis, setAnalysis] = useState<ThakaaMedAnalysisResponse | null>(null);
  const [spatialContext, setSpatialContext] = useState<SpatialContext | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [sessionSource, setSessionSource] = useState<"none" | "demo" | "live">("none");
  const [language, setLanguage] = useState<MentorLanguage>("en");
  const [speed, setSpeed] = useState(1);
  const [script, setScript] = useState<ScriptEvent[]>([]);
  const [scriptLanguage, setScriptLanguage] = useState<MentorLanguage | null>(null);
  const [selectedToothId, setSelectedToothId] = useState<string | null>(null);
  const [currentLine, setCurrentLine] = useState("");
  const [statusMessage, setStatusMessage] = useState(
    "Upload a radiograph or launch demo mode to start the teaching session.",
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [voicesReady, setVoicesReady] = useState(false);
  const [playbackState, setPlaybackState] = useState<
    "idle" | "ready" | "playing" | "paused" | "completed"
  >("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void waitForVoices().then(() => setVoicesReady(true));
  }, []);

  const busy = isAnalyzing || isGeneratingScript;
  const summaryCards = useMemo(() => {
    if (!spatialContext) {
      return [];
    }

    return [
      {
        label: "Teeth with findings",
        value: spatialContext.summary.teethWithFindings,
      },
      {
        label: "Tooth findings",
        value: spatialContext.summary.totalToothFindings,
      },
      {
        label: "Palate / region findings",
        value:
          spatialContext.summary.palateFindings + spatialContext.summary.regionFindings,
      },
    ];
  }, [spatialContext]);

  const releasePauseWaiters = useCallback(() => {
    pauseResolversRef.current.splice(0).forEach((resolve) => resolve());
  }, []);

  const stopPlayback = useCallback(
    async (nextState: "idle" | "ready" = "ready") => {
      playbackAbortRef.current?.abort();
      playbackAbortRef.current = null;
      cancelSpeech();
      releasePauseWaiters();
      setPlaybackState(nextState);
      setCurrentLine("");
      await canvasRef.current?.resetView();
    },
    [releasePauseWaiters],
  );

  useEffect(() => {
    return () => {
      void stopPlayback("idle");
    };
  }, [stopPlayback]);

  const waitIfPaused = useCallback(async (signal: AbortSignal) => {
    while (playbackState === "paused") {
      await new Promise<void>((resolve, reject) => {
        const onAbort = () => {
          signal.removeEventListener("abort", onAbort);
          reject(createAbortError());
        };

        pauseResolversRef.current.push(() => {
          signal.removeEventListener("abort", onAbort);
          resolve();
        });

        signal.addEventListener("abort", onAbort, { once: true });
      });
    }

    if (signal.aborted) {
      throw createAbortError();
    }
  }, [playbackState]);

  const handleLanguageChange = useCallback(
    (nextLanguage: MentorLanguage) => {
      setLanguage(nextLanguage);
      if (sessionSource === "demo") {
        setScript(getDemoScript(nextLanguage));
        setScriptLanguage(nextLanguage);
      } else {
        setScript([]);
        setScriptLanguage(null);
      }
    },
    [sessionSource],
  );

  const handleTryDemo = useCallback(async () => {
    await stopPlayback("ready");
    setSessionSource("demo");
    setAnalysis(null);
    setSpatialContext(DEMO_SPATIAL_CONTEXT);
    setImageSrc(DEMO_IMAGE_SRC);
    setSelectedToothId(DEMO_SPATIAL_CONTEXT.orderedTeeth[0]);
    setScript(getDemoScript(language));
    setScriptLanguage(language);
    setStatusMessage("Offline demo loaded. No ThakaaMed or Claude requests were made.");
    setPlaybackState("ready");
    setError(null);
  }, [language, stopPlayback]);

  const handleFileSelected = useCallback(
    async (file: File) => {
      await stopPlayback("ready");
      setIsAnalyzing(true);
      setError(null);
      setStatusMessage(`Submitting ${file.name} to ThakaaMed...`);

      try {
        const { analysis: nextAnalysis, fromCache } = await analyzeWithCache(file, language);
        const nextContext = buildSpatialContext(nextAnalysis);
        setSessionSource("live");
        setAnalysis(nextAnalysis);
        setSpatialContext(nextContext);
        setImageSrc(nextAnalysis.draw_image || nextAnalysis.original_image);
        setSelectedToothId(nextContext.orderedTeeth[0] ?? null);
        setScript([]);
        setScriptLanguage(null);
        setPlaybackState("ready");
        setStatusMessage(
          fromCache
            ? "Loaded cached analysis. Start the mentor when you are ready."
            : "Analysis ready. Generate the mentor script to begin playback.",
        );
      } catch (uploadError) {
        const message =
          uploadError instanceof Error
            ? uploadError.message
            : "Unable to analyze the radiograph.";
        setError(message);
        setStatusMessage("Analysis failed.");
      } finally {
        setIsAnalyzing(false);
      }
    },
    [language, stopPlayback],
  );

  const ensureScript = useCallback(async () => {
    if (!spatialContext) {
      throw new Error("No spatial context available.");
    }

    if (sessionSource === "demo") {
      const demoScript = getDemoScript(language);
      setScript(demoScript);
      setScriptLanguage(language);
      return demoScript;
    }

    if (script.length > 0 && scriptLanguage === language) {
      return script;
    }

    setIsGeneratingScript(true);
    setStatusMessage("Generating a Claude mentor script...");

    try {
      const response = await fetch("/api/mentor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spatialContext, language }),
      });

      const payload = (await response.json()) as { script?: ScriptEvent[]; error?: string };
      if (!response.ok || !payload.script) {
        throw new Error(payload.error ?? "Failed to generate the mentor script.");
      }

      setScript(payload.script);
      setScriptLanguage(language);
      return payload.script;
    } finally {
      setIsGeneratingScript(false);
    }
  }, [language, script, scriptLanguage, sessionSource, spatialContext]);

  const runCanvasEvent = useCallback(async (event: Extract<ScriptEvent, { type: "canvas" }>) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    switch (event.tool) {
      case "zoom_to_tooth":
        if (event.input.tooth_id) {
          setSelectedToothId(event.input.tooth_id);
          await canvas.zoomToTooth(event.input.tooth_id);
        }
        break;
      case "highlight_region":
        if (event.input.tooth_id) {
          setSelectedToothId(event.input.tooth_id);
          await canvas.highlightRegion(
            event.input.tooth_id,
            event.input.color,
            event.input.opacity,
            event.input.label,
          );
        }
        break;
      case "annotate":
        if (event.input.tooth_id && event.input.label) {
          await canvas.annotate(event.input.tooth_id, event.input.label);
        }
        break;
      case "reset_view":
        await canvas.resetView();
        break;
      default:
        break;
    }
  }, []);

  const runPlayback = useCallback(
    async (nextScript: ScriptEvent[]) => {
      if (!nextScript.length) {
        throw new Error("The mentor script was empty.");
      }

      await stopPlayback("ready");
      const controller = new AbortController();
      playbackAbortRef.current = controller;
      setPlaybackState("playing");
      setError(null);
      setStatusMessage("Mentor session in progress.");

      try {
        for (const event of nextScript) {
          await waitIfPaused(controller.signal);

          if (event.type === "speak") {
            setCurrentLine(event.text);
            await speakText({
              text: event.text,
              language,
              rate: speed,
              signal: controller.signal,
            });
          } else {
            await runCanvasEvent(event);
          }
        }

        setPlaybackState("completed");
        setStatusMessage("Session complete. You can replay it or inspect findings manually.");
      } catch (playbackError) {
        if (
          playbackError instanceof DOMException &&
          playbackError.name === "AbortError"
        ) {
          return;
        }

        const message =
          playbackError instanceof Error
            ? playbackError.message
            : "Playback failed unexpectedly.";
        setError(message);
        setStatusMessage("Playback failed.");
        setPlaybackState("ready");
      }
    },
    [language, runCanvasEvent, speed, stopPlayback, waitIfPaused],
  );

  const handleStart = useCallback(async () => {
    try {
      const nextScript = await ensureScript();
      await runPlayback(nextScript);
    } catch (startError) {
      const message =
        startError instanceof Error ? startError.message : "Unable to start the mentor session.";
      setError(message);
      setStatusMessage("Unable to start the mentor session.");
    }
  }, [ensureScript, runPlayback]);

  const handlePause = useCallback(() => {
    if (playbackState !== "playing") {
      return;
    }

    pauseSpeech();
    setPlaybackState("paused");
    setStatusMessage("Session paused.");
  }, [playbackState]);

  const handleResume = useCallback(() => {
    if (playbackState !== "paused") {
      return;
    }

    resumeSpeech();
    setPlaybackState("playing");
    setStatusMessage("Session resumed.");
    releasePauseWaiters();
  }, [playbackState, releasePauseWaiters]);

  const handleStop = useCallback(() => {
    void stopPlayback(sessionSource === "none" ? "idle" : "ready");
    setStatusMessage("Session stopped.");
  }, [sessionSource, stopPlayback]);

  const handleSelectTooth = useCallback(
    async (toothId: string) => {
      setSelectedToothId(toothId);
      if (!spatialContext || playbackState === "playing" || playbackState === "paused") {
        return;
      }

      const tooth = spatialContext.teeth[toothId];
      if (!tooth || !canvasRef.current) {
        return;
      }

      await canvasRef.current.zoomToTooth(toothId);
      await canvasRef.current.highlightRegion(
        toothId,
        getToothPrimaryColor(tooth),
        0.28,
        tooth.findings[0]?.label,
      );
    },
    [playbackState, spatialContext],
  );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-[32px] border border-white/10 bg-slate-900/70 px-6 py-8 shadow-2xl shadow-slate-950/40 backdrop-blur">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.36em] text-cyan-200">
              DentalMentor AI
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              AI-guided dental radiology with synchronized voice, zoom, and highlights.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
              Upload a radiograph, let ThakaaMed detect clinically relevant findings, then
              let a Claude-powered mentor narrate the case while the Konva canvas zooms to
              the relevant teeth.
            </p>
          </div>
          <div className="rounded-3xl border border-amber-400/20 bg-amber-400/10 px-5 py-4 text-sm leading-6 text-amber-50">
            ⚠️ This tool is a demonstration prototype. It does not replace a consultation
            with a qualified dentist.
          </div>
        </div>
      </section>

      <UploadZone busy={busy} onFileSelected={handleFileSelected} onTryDemo={() => void handleTryDemo()} />

      <section className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/30">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100">
              {sessionSource === "demo"
                ? "Demo mode"
                : sessionSource === "live"
                  ? "Live analysis"
                  : "Awaiting image"}
            </span>
            {analysis && (
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-slate-300">
                {analysis.results.image_type}
              </span>
            )}
            <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-slate-300">
              {LANGUAGE_META[language].label}
            </span>
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-300">{statusMessage}</p>
          {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
          {summaryCards.length > 0 && (
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {summaryCards.map((card) => (
                <div
                  key={card.label}
                  className="rounded-2xl border border-white/10 bg-slate-950/50 p-4"
                >
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{card.label}</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{card.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <MentorPanel
          language={language}
          onLanguageChange={handleLanguageChange}
          speed={speed}
          onSpeedChange={setSpeed}
          onStart={handleStart}
          onPause={handlePause}
          onResume={handleResume}
          onStop={handleStop}
          playbackState={playbackState}
          busy={busy}
          voicesReady={voicesReady}
          currentLine={currentLine}
          sessionLabel={
            sessionSource === "demo"
              ? "Offline sample session using bundled panoramic data."
              : sessionSource === "live"
                ? "Claude will produce a tool-use script from the live spatial context."
                : "Select a radiograph to prepare the mentor session."
          }
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <RadiographCanvas
          ref={canvasRef}
          imageSrc={imageSrc}
          spatialContext={spatialContext}
          selectedToothId={selectedToothId}
          onToothSelect={(toothId) => {
            void handleSelectTooth(toothId);
          }}
        />
        <FindingsList
          spatialContext={spatialContext}
          selectedToothId={selectedToothId}
          onSelectTooth={(toothId) => {
            void handleSelectTooth(toothId);
          }}
        />
      </section>
    </main>
  );
}
