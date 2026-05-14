import { NextResponse } from "next/server";

import { buildFallbackMentorScript } from "@/lib/sampleScript";
import type {
  CanvasToolName,
  HighlightColor,
  MentorLanguage,
  ScriptEvent,
} from "@/types/script";
import type { SpatialContext } from "@/types/thakaamed";

export const runtime = "nodejs";

interface ConversationTurnInput {
  role: "user" | "assistant";
  text: string;
}

const TOOL_NAMES: CanvasToolName[] = [
  "zoom_to_tooth",
  "highlight_region",
  "annotate",
  "reset_view",
];
const HIGHLIGHT_COLORS: HighlightColor[] = ["red", "yellow", "green", "blue"];

function parseLanguage(raw: unknown): MentorLanguage {
  return raw === "fr" || raw === "ar" ? raw : "en";
}

function normalizeToolName(raw: unknown): CanvasToolName | null {
  return typeof raw === "string" && TOOL_NAMES.includes(raw as CanvasToolName)
    ? (raw as CanvasToolName)
    : null;
}

function sanitizeCanvasInput(
  input: Record<string, unknown>,
  tool: CanvasToolName,
): Extract<ScriptEvent, { type: "canvas" }>["input"] {
  const nextColor =
    typeof input.color === "string" && HIGHLIGHT_COLORS.includes(input.color as HighlightColor)
      ? (input.color as HighlightColor)
      : undefined;
  const nextOpacity =
    typeof input.opacity === "number"
      ? Math.min(0.55, Math.max(0.15, input.opacity))
      : 0.35;

  return {
    tooth_id:
      tool === "reset_view"
        ? undefined
        : typeof input.tooth_id === "string"
          ? input.tooth_id
          : undefined,
    color: nextColor,
    opacity: nextOpacity,
    label: typeof input.label === "string" ? input.label : undefined,
  };
}

function buildSystemPrompt(language: MentorLanguage) {
  const languageName = language === "fr" ? "French" : language === "ar" ? "Arabic" : "English";
  return [
    "You are DentalMentor AI, a supportive dental radiology teaching mentor.",
    `Always respond in ${languageName}.`,
    "Your output must be sequential for an interactive canvas: interleave short text explanations with tool calls.",
    "For each tooth you discuss, first zoom, then highlight, optionally annotate, explain briefly, and finally reset view.",
    "Keep all text concise and educational.",
    "Only discuss teeth/findings present in the provided spatial context.",
  ].join(" ");
}

function parseTurns(raw: string): ConversationTurnInput[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((item): item is ConversationTurnInput => {
        if (!item || typeof item !== "object") {
          return false;
        }
        const row = item as Record<string, unknown>;
        return (
          (row.role === "user" || row.role === "assistant") &&
          typeof row.text === "string" &&
          row.text.trim().length > 0
        );
      })
      .slice(-10);
  } catch {
    return [];
  }
}

async function callWhisper(audio: File, apiKey: string) {
  const formData = new FormData();
  formData.set("file", audio, audio.name || "recording.webm");
  formData.set("model", "whisper-1");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
    cache: "no-store",
  });

  const payload = (await response.json()) as { text?: string; error?: { message?: string } };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Whisper transcription failed.");
  }
  return (payload.text ?? "").trim();
}

async function synthesizeSpeech(text: string, apiKey: string) {
  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini-tts",
      voice: "alloy",
      format: "mp3",
      input: text.slice(0, 2000),
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    throw new Error(payload?.error?.message ?? "TTS generation failed.");
  }

  const audioBuffer = await response.arrayBuffer();
  return Buffer.from(audioBuffer).toString("base64");
}

async function callClaude(
  spatialContext: SpatialContext,
  language: MentorLanguage,
  userMessage: string,
  history: ConversationTurnInput[],
): Promise<ScriptEvent[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return buildFallbackMentorScript(spatialContext, language);
  }

  const tools = [
    {
      name: "zoom_to_tooth",
      description: "Zoom the canvas to a single tooth before you talk about it.",
      input_schema: {
        type: "object",
        properties: {
          tooth_id: { type: "string" },
        },
        required: ["tooth_id"],
      },
    },
    {
      name: "highlight_region",
      description: "Highlight the current tooth using a clinical color code.",
      input_schema: {
        type: "object",
        properties: {
          tooth_id: { type: "string" },
          color: { type: "string", enum: HIGHLIGHT_COLORS },
          opacity: { type: "number" },
          label: { type: "string" },
        },
        required: ["tooth_id", "color"],
      },
    },
    {
      name: "annotate",
      description: "Add a short on-canvas text label for the current teaching point.",
      input_schema: {
        type: "object",
        properties: {
          tooth_id: { type: "string" },
          label: { type: "string" },
        },
        required: ["tooth_id", "label"],
      },
    },
    {
      name: "reset_view",
      description: "Reset the canvas to the full radiograph before moving on.",
      input_schema: {
        type: "object",
        properties: {},
      },
    },
  ];

  const messages: Array<Record<string, unknown>> = [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `Conversation history: ${JSON.stringify(history)}\nUser message: ${userMessage}\nSpatial context: ${JSON.stringify(spatialContext)}`,
        },
      ],
    },
  ];

  const script: ScriptEvent[] = [];

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1400,
        temperature: 0.35,
        system: buildSystemPrompt(language),
        tools,
        messages,
      }),
      cache: "no-store",
    });

    const payload = (await response.json()) as {
      content?: Array<Record<string, unknown>>;
      stop_reason?: string;
      error?: { message?: string };
    };

    if (!response.ok) {
      throw new Error(payload.error?.message ?? "Claude conversation generation failed.");
    }

    const content = payload.content ?? [];
    messages.push({ role: "assistant", content });
    const toolResults: Array<Record<string, unknown>> = [];

    for (const block of content) {
      if (block.type === "text" && typeof block.text === "string" && block.text.trim()) {
        script.push({ type: "speak", text: block.text.trim() });
      }

      if (block.type === "tool_use") {
        const tool = normalizeToolName(block.name);
        if (!tool || typeof block.id !== "string") {
          continue;
        }

        const input =
          block.input && typeof block.input === "object"
            ? sanitizeCanvasInput(block.input as Record<string, unknown>, tool)
            : {};

        script.push({ type: "canvas", tool, input });
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: "Canvas step queued.",
        });
      }
    }

    if (payload.stop_reason !== "tool_use" || toolResults.length === 0) {
      break;
    }

    messages.push({ role: "user", content: toolResults });
  }

  return script.length > 0 ? script : buildFallbackMentorScript(spatialContext, language);
}

async function attachTtsAudio(script: ScriptEvent[], apiKey: string): Promise<ScriptEvent[]> {
  const enriched: ScriptEvent[] = [];
  for (const event of script) {
    if (event.type !== "speak" || !event.text.trim()) {
      enriched.push(event);
      continue;
    }

    const audioBase64 = await synthesizeSpeech(event.text, apiKey);
    enriched.push({
      ...event,
      audioBase64,
      audioMimeType: "audio/mpeg",
    });
  }
  return enriched;
}

export async function POST(request: Request) {
  try {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY. Whisper and gpt-4o-mini-tts require it." },
        { status: 500 },
      );
    }

    const formData = await request.formData();
    const spatialContextRaw = formData.get("spatialContext");
    const language = parseLanguage(formData.get("language"));
    const textInput = (formData.get("text")?.toString() ?? "").trim();
    const history = parseTurns(formData.get("history")?.toString() ?? "");
    const audioInput = formData.get("audio");

    if (typeof spatialContextRaw !== "string") {
      return NextResponse.json({ error: "Missing spatial context." }, { status: 400 });
    }

    const spatialContext = JSON.parse(spatialContextRaw) as SpatialContext;

    let whisperTranscript = "";
    if (audioInput instanceof File) {
      whisperTranscript = await callWhisper(audioInput, openaiApiKey);
    }

    const userText = textInput || whisperTranscript;
    if (!userText) {
      return NextResponse.json({ error: "Please provide text or recorded audio." }, { status: 400 });
    }

    const script = await callClaude(spatialContext, language, userText, history);
    const scriptWithAudio = await attachTtsAudio(script, openaiApiKey);

    return NextResponse.json({
      userTranscript: userText,
      script: scriptWithAudio,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Conversation request failed." },
      { status: 500 },
    );
  }
}
