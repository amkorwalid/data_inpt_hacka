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
    "Use the provided tools to stage the canvas actions.",
    "For each tooth you discuss, first zoom, then highlight, then provide a short explanation, and finally reset the view.",
    "Stay concise and focus on the most instructive findings only.",
    "Do not invent teeth or findings that are not present in the spatial context.",
  ].join(" ");
}

async function callClaude(
  spatialContext: SpatialContext,
  language: MentorLanguage,
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
          text: `Create a short teaching session from this spatial context: ${JSON.stringify(spatialContext)}`,
        },
      ],
    },
  ];
  const script: ScriptEvent[] = [];

  for (let attempt = 0; attempt < 6; attempt += 1) {
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
        temperature: 0.4,
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
      throw new Error(payload.error?.message ?? "Claude mentor generation failed.");
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
          content: "Queued for playback.",
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

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      spatialContext?: SpatialContext;
      language?: MentorLanguage;
    };

    if (!body.spatialContext) {
      return NextResponse.json({ error: "Missing spatial context." }, { status: 400 });
    }

    const language = parseLanguage(body.language);
    const script = await callClaude(body.spatialContext, language);
    return NextResponse.json({ script });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Mentor generation failed." },
      { status: 500 },
    );
  }
}
