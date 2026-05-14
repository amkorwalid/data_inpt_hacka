import { hashFile, readCachedAnalysis, writeCachedAnalysis } from "@/lib/cache";
import type { MentorLanguage } from "@/types/script";
import type { ThakaaMedAnalysisResponse } from "@/types/thakaamed";

const ANALYSIS_SLUG_PATTERN = /^[a-zA-Z0-9-]{8,128}$/;

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function normalizeBaseUrl(language: MentorLanguage) {
  const raw = getRequiredEnv("THAKAAMED_BASE_URL");
  const normalized = raw.endsWith("/") ? raw : `${raw}/`;
  return normalized.replace(/\/(en|fr|ar)\//, `/${language}/`);
}

async function parseJsonResponse(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    if (!response.ok) {
      throw new Error(`Unexpected non-JSON response (${response.status}).`);
    }
    return text;
  }
}

function extractSlug(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const objectPayload = payload as Record<string, unknown>;
  return (
    (typeof objectPayload.slug === "string" && objectPayload.slug) ||
    (typeof objectPayload.id === "string" && objectPayload.id) ||
    (objectPayload.data &&
    typeof objectPayload.data === "object" &&
    typeof (objectPayload.data as Record<string, unknown>).slug === "string"
      ? ((objectPayload.data as Record<string, unknown>).slug as string)
      : null)
  );
}

function assertValidSlug(slug: string) {
  if (!ANALYSIS_SLUG_PATTERN.test(slug)) {
    throw new Error("Invalid analysis slug.");
  }
}

export async function submitThakaaMedAnalysis(
  image: File,
  language: MentorLanguage,
) {
  const formData = new FormData();
  formData.set("image", image, image.name);
  formData.set("api_key", getRequiredEnv("THAKAAMED_API_KEY"));
  formData.set("facility_code", getRequiredEnv("THAKAAMED_FACILITY_CODE"));

  const response = await fetch(normalizeBaseUrl(language), {
    method: "POST",
    body: formData,
    cache: "no-store",
  });

  const payload = await parseJsonResponse(response);
  if (!response.ok) {
    const message =
      (payload as Record<string, string> | undefined)?.error_message ??
      (payload as Record<string, string> | undefined)?.message ??
      `ThakaaMed submit failed with ${response.status}.`;
    throw new Error(message);
  }

  const slug = extractSlug(payload);
  if (!slug) {
    throw new Error("ThakaaMed submit response did not include a slug.");
  }

  return { slug };
}

export async function pollThakaaMedAnalysis(
  slug: string,
  language: MentorLanguage,
): Promise<ThakaaMedAnalysisResponse> {
  assertValidSlug(slug);
  const apiKey = getRequiredEnv("THAKAAMED_API_KEY");
  const facilityCode = getRequiredEnv("THAKAAMED_FACILITY_CODE");
  const requestUrl = new URL(normalizeBaseUrl(language));
  requestUrl.searchParams.set("slug", slug);
  requestUrl.searchParams.set("api_key", apiKey);
  requestUrl.searchParams.set("facility_code", facilityCode);

  const response = await fetch(requestUrl, {
    method: "GET",
    cache: "no-store",
  });
  const payload = (await parseJsonResponse(response)) as ThakaaMedAnalysisResponse;

  if (!response.ok) {
    throw new Error(payload.error_message || payload.message || `Polling failed (${response.status}).`);
  }

  return payload;
}

function wait(delayMs: number) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, delayMs));
}

export async function analyzeWithCache(file: File, language: MentorLanguage) {
  const hash = await hashFile(file);
  const cached = readCachedAnalysis(hash);
  if (cached) {
    return { analysis: cached, fromCache: true };
  }

  const formData = new FormData();
  formData.set("image", file, file.name);
  formData.set("language", language);

  const submitResponse = await fetch("/api/analyze", {
    method: "POST",
    body: formData,
  });

  if (!submitResponse.ok) {
    const payload = (await submitResponse.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(payload?.error ?? "Failed to submit the radiograph.");
  }

  const submission = (await submitResponse.json()) as { slug: string };

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const pollResponse = await fetch(
      `/api/analyze?slug=${encodeURIComponent(submission.slug)}&language=${language}`,
      { cache: "no-store" },
    );

    if (!pollResponse.ok) {
      const payload = (await pollResponse.json().catch(() => null)) as
        | { error?: string }
        | null;
      throw new Error(payload?.error ?? "Failed to poll the analysis job.");
    }

    const analysis = (await pollResponse.json()) as ThakaaMedAnalysisResponse;
    if (analysis.is_done) {
      writeCachedAnalysis(hash, analysis);
      return { analysis, fromCache: false };
    }

    await wait(2500);
  }

  throw new Error("The analysis did not finish in time. Please try again.");
}
