import { NextResponse } from "next/server";

import { pollThakaaMedAnalysis, submitThakaaMedAnalysis } from "@/lib/thakaamed";
import type { MentorLanguage } from "@/types/script";

export const runtime = "nodejs";

function parseLanguage(raw: string | null): MentorLanguage {
  if (raw === "fr" || raw === "ar") {
    return raw;
  }

  return "en";
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const image = formData.get("image");
    const language = parseLanguage(formData.get("language")?.toString() ?? null);

    if (!(image instanceof File)) {
      return NextResponse.json({ error: "An image file is required." }, { status: 400 });
    }

    const submission = await submitThakaaMedAnalysis(image, language);
    return NextResponse.json(submission);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Analysis submission failed." },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug");
    const language = parseLanguage(searchParams.get("language"));

    if (!slug) {
      return NextResponse.json({ error: "Missing slug." }, { status: 400 });
    }

    const analysis = await pollThakaaMedAnalysis(slug, language);
    return NextResponse.json(analysis);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Analysis polling failed." },
      { status: 500 },
    );
  }
}
