"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CanvasSelectorPanel } from "@/components/CanvasSelectorPanel";
import { MentorPanel } from "@/components/MentorPanel";
import {
  RadiographCanvas,
  type RadiographCanvasHandle,
} from "@/components/RadiographCanvas";
import { UploadZone } from "@/components/UploadZone";
import { getToothPrimaryColor, toneToHighlightColor } from "@/lib/canvasOps";
import {
  readConversationTurns,
  type ConversationTurn,
  writeConversationTurns,
} from "@/lib/conversationStorage";
import { DEMO_IMAGE_SRC, DEMO_SPATIAL_CONTEXT } from "@/lib/sampleData";
import { buildSpatialContext } from "@/lib/spatialContext";
import { analyzeWithCache } from "@/lib/thakaamed";
import { cancelSpeech, speakText } from "@/lib/scriptPlayer";
import { LANGUAGE_META, type MentorLanguage, type ScriptEvent } from "@/types/script";
import type { SpatialContext, SpatialFinding, ThakaaMedAnalysisResponse } from "@/types/thakaamed";

function createAbortError() {
  return new DOMException("Playback aborted", "AbortError");
}

function appendTurns(current: ConversationTurn[], next: ConversationTurn[]) {
  return [...current, ...next].slice(-40);
}

export default function DashboardPage() {
  const canvasRef = useRef<RadiographCanvasHandle | null>(null);
  const playbackAbortRef = useRef<AbortController | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  const [analysis, setAnalysis] = useState<ThakaaMedAnalysisResponse | null>(null);
  const [spatialContext, setSpatialContext] = useState<SpatialContext | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [sessionSource, setSessionSource] = useState<"none" | "demo" | "live">("none");
  const [language, setLanguage] = useState<MentorLanguage>("en");
  const [selectedToothId, setSelectedToothId] = useState<string | null>(null);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [currentLine, setCurrentLine] = useState("");
  const [statusMessage, setStatusMessage] = useState(
    "Upload a radiograph or launch demo mode, then talk with the mentor using voice or text.",
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isProcessingMessage, setIsProcessingMessage] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [messageInput, setMessageInput] = useState("");
  const [conversation, setConversation] = useState<ConversationTurn[]>(() => readConversationTurns());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    writeConversationTurns(conversation);
  }, [conversation]);

  const busy = isAnalyzing || isProcessingMessage;

  const areaLookup = useMemo(() => {
    if (!spatialContext) {
      return {} as Record<string, SpatialFinding>;
    }

    return Object.fromEntries(
      [...spatialContext.palateFindings, ...spatialContext.regionFindings].map((area) => [area.id, area]),
    );
  }, [spatialContext]);

  const stopPlayback = useCallback(
    async (nextLine = "") => {
      playbackAbortRef.current?.abort();
      playbackAbortRef.current = null;
      currentAudioRef.current?.pause();
      currentAudioRef.current = null;
      cancelSpeech();
      setCurrentLine(nextLine);
      await canvasRef.current?.resetView();
    },
    [],
  );

  useEffect(() => {
    return () => {
      void stopPlayback();
      mediaRecorderRef.current?.stream.getTracks().forEach((track) => track.stop());
    };
  }, [stopPlayback]);

  const handleLanguageChange = useCallback((nextLanguage: MentorLanguage) => {
    setLanguage(nextLanguage);
    setSelectedAreaId(null);
  }, []);

  const handleTryDemo = useCallback(async () => {
    await stopPlayback();
    setSessionSource("demo");
    setAnalysis(null);
    setSpatialContext(DEMO_SPATIAL_CONTEXT);
    setImageSrc(DEMO_IMAGE_SRC);
    setSelectedToothId(DEMO_SPATIAL_CONTEXT.orderedTeeth[0]);
    setSelectedAreaId(null);
    setStatusMessage("Offline demo loaded. Start a voice/text conversation with the mentor.");
    setError(null);
  }, [stopPlayback]);

  const handleFileSelected = useCallback(
    async (file: File) => {
      await stopPlayback();
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
        setSelectedAreaId(null);
        setStatusMessage(
          fromCache
            ? "Loaded cached analysis. Start speaking or type to continue."
            : "Analysis ready. Start speaking or type your first mentor message.",
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

  const runCanvasEvent = useCallback(async (event: Extract<ScriptEvent, { type: "canvas" }>) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    switch (event.tool) {
      case "zoom_to_tooth":
        if (event.input.tooth_id) {
          setSelectedAreaId(null);
          setSelectedToothId(event.input.tooth_id);
          await canvas.zoomToTooth(event.input.tooth_id);
        }
        break;
      case "highlight_region":
        if (event.input.tooth_id) {
          setSelectedAreaId(null);
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
        setSelectedAreaId(null);
        await canvas.resetView();
        break;
      default:
        break;
    }
  }, []);

  const animateLine = useCallback(async (text: string, signal: AbortSignal) => {
    setCurrentLine("");
    for (let index = 1; index <= text.length; index += 1) {
      if (signal.aborted) {
        throw createAbortError();
      }
      setCurrentLine(text.slice(0, index));
      await new Promise((resolve) => window.setTimeout(resolve, 12));
    }
  }, []);

  const playBase64Audio = useCallback(async (base64: string, mimeType: string, signal: AbortSignal) => {
    const source = `data:${mimeType};base64,${base64}`;
    await new Promise<void>((resolve, reject) => {
      const audio = new Audio(source);
      currentAudioRef.current = audio;

      const onAbort = () => {
        audio.pause();
        signal.removeEventListener("abort", onAbort);
        reject(createAbortError());
      };

      signal.addEventListener("abort", onAbort, { once: true });
      audio.onended = () => {
        signal.removeEventListener("abort", onAbort);
        resolve();
      };
      audio.onerror = () => {
        signal.removeEventListener("abort", onAbort);
        reject(new Error("Generated audio playback failed."));
      };

      void audio.play().catch(() => {
        signal.removeEventListener("abort", onAbort);
        reject(new Error("Audio autoplay blocked. Please interact with the page and retry."));
      });
    });
  }, []);

  const playScript = useCallback(
    async (script: ScriptEvent[]) => {
      if (!script.length) {
        throw new Error("The mentor response was empty.");
      }

      await stopPlayback();
      const controller = new AbortController();
      playbackAbortRef.current = controller;
      setError(null);
      setStatusMessage("Mentor response in progress.");

      try {
        for (const event of script) {
          if (controller.signal.aborted) {
            throw createAbortError();
          }

          if (event.type === "speak") {
            const animatePromise = animateLine(event.text, controller.signal);
            const speechPromise = event.audioBase64
              ? playBase64Audio(event.audioBase64, event.audioMimeType ?? "audio/mpeg", controller.signal)
              : speakText({
                  text: event.text,
                  language,
                  rate: 1,
                  signal: controller.signal,
                });

            await Promise.all([animatePromise, speechPromise]);
          } else {
            await runCanvasEvent(event);
          }
        }

        setStatusMessage("Response complete. Ask the next question by voice or text.");
      } catch (playbackError) {
        if (playbackError instanceof DOMException && playbackError.name === "AbortError") {
          return;
        }

        const message =
          playbackError instanceof Error ? playbackError.message : "Playback failed unexpectedly.";
        setError(message);
        setStatusMessage("Playback failed.");
      }
    },
    [animateLine, language, playBase64Audio, runCanvasEvent, stopPlayback],
  );

  const requestConversationTurn = useCallback(
    async (input: { text?: string; audio?: Blob }) => {
      if (!spatialContext) {
        setError("Upload a radiograph or load demo mode before starting a conversation.");
        return;
      }

      setIsProcessingMessage(true);
      setError(null);
      setStatusMessage("Transcribing and generating mentor response...");

      try {
        const formData = new FormData();
        formData.set("spatialContext", JSON.stringify(spatialContext));
        formData.set("language", language);
        formData.set(
          "history",
          JSON.stringify(
            conversation.map((turn) => ({
              role: turn.role,
              text: turn.text,
            })),
          ),
        );
        if (input.text?.trim()) {
          formData.set("text", input.text.trim());
        }
        if (input.audio) {
          formData.set("audio", new File([input.audio], "recording.webm", { type: input.audio.type || "audio/webm" }));
        }

        const response = await fetch("/api/conversation", {
          method: "POST",
          body: formData,
        });
        const payload = (await response.json()) as {
          error?: string;
          userTranscript?: string;
          script?: ScriptEvent[];
        };

        if (!response.ok || !payload.script || !payload.userTranscript) {
          throw new Error(payload.error ?? "Conversation request failed.");
        }

        const assistantText = payload.script
          .filter((event): event is Extract<ScriptEvent, { type: "speak" }> => event.type === "speak")
          .map((event) => event.text)
          .join(" ")
          .trim();

        setConversation((current) =>
          appendTurns(current, [
            { role: "user", text: payload.userTranscript!, at: Date.now() },
            ...(assistantText
              ? [{ role: "assistant" as const, text: assistantText, at: Date.now() + 1 }]
              : []),
          ]),
        );

        await playScript(payload.script);
      } finally {
        setMessageInput("");
        setIsProcessingMessage(false);
      }
    },
    [conversation, language, playScript, spatialContext],
  );

  const handleSendText = useCallback(async () => {
    if (!messageInput.trim() || busy) {
      return;
    }
    await requestConversationTurn({ text: messageInput });
  }, [busy, messageInput, requestConversationTurn]);

  const handleToggleRecording = useCallback(async () => {
    if (busy) {
      return;
    }

    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Audio recording is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          mediaChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(mediaChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        stream.getTracks().forEach((track) => track.stop());
        mediaRecorderRef.current = null;
        if (blob.size > 0) {
          void requestConversationTurn({ audio: blob });
        }
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setError(null);
      setIsRecording(true);
      setStatusMessage("Recording started. Click again to stop and send for transcription.");
    } catch {
      setError("Unable to access microphone.");
    }
  }, [busy, isRecording, requestConversationTurn]);

  const handleSelectTooth = useCallback(
    async (toothId: string) => {
      setSelectedAreaId(null);
      setSelectedToothId(toothId);
      if (!spatialContext) {
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
    [spatialContext],
  );

  const handleSelectArea = useCallback(async (area: SpatialFinding) => {
    setSelectedToothId(null);
    setSelectedAreaId(area.id);
    if (!canvasRef.current) {
      return;
    }

    await canvasRef.current.highlightPolygon(
      area.id,
      area.polygon,
      toneToHighlightColor(area.tone),
      0.28,
      area.label,
    );
  }, []);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1800px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-[32px] border border-white/10 bg-slate-900/70 px-6 py-6 shadow-2xl shadow-slate-950/40 backdrop-blur">
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
      </section>

      <UploadZone busy={busy} onFileSelected={handleFileSelected} onTryDemo={() => void handleTryDemo()} />

      <section className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)_380px]">
        <CanvasSelectorPanel
          spatialContext={spatialContext}
          selectedToothId={selectedToothId}
          selectedAreaId={selectedAreaId}
          onSelectTooth={(toothId) => {
            void handleSelectTooth(toothId);
          }}
          onSelectArea={(area) => {
            void handleSelectArea(area);
          }}
        />

        <RadiographCanvas
          ref={canvasRef}
          imageSrc={imageSrc}
          spatialContext={spatialContext}
          selectedToothId={selectedToothId}
          selectedAreaPolygon={selectedAreaId ? areaLookup[selectedAreaId]?.polygon ?? null : null}
          onToothSelect={(toothId) => {
            void handleSelectTooth(toothId);
          }}
        />

        <MentorPanel
          language={language}
          onLanguageChange={handleLanguageChange}
          busy={busy}
          isRecording={isRecording}
          message={messageInput}
          onMessageChange={setMessageInput}
          onSendText={handleSendText}
          onToggleRecording={handleToggleRecording}
          currentLine={currentLine}
          sessionLabel={
            sessionSource === "demo"
              ? "Offline sample canvas with live voice/text mentor conversation."
              : sessionSource === "live"
                ? "Recorded audio is transcribed, sent to the LLM, and played back with canvas animation."
                : "Select a radiograph first, then talk to the mentor."
          }
          conversation={conversation}
        />
      </section>
    </main>
  );
}
