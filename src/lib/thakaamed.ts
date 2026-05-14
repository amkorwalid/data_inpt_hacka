import { hashFile, readCachedAnalysis, writeCachedAnalysis } from "@/lib/cache";
import type { MentorLanguage } from "@/types/script";
import type { ThakaaMedAnalysisResponse } from "@/types/thakaamed";

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
  const apiKey = getRequiredEnv("THAKAAMED_API_KEY");
  const facilityCode = getRequiredEnv("THAKAAMED_FACILITY_CODE");
  const base = normalizeBaseUrl(language);
  const candidates = [new URL(`${slug}/`, base), new URL(base)];

  candidates[1].searchParams.set("slug", slug);

  let lastError: Error | null = null;

  for (const candidate of candidates) {
    candidate.searchParams.set("api_key", apiKey);
    candidate.searchParams.set("facility_code", facilityCode);

    try {
      const response = await fetch(candidate, {
        method: "GET",
        cache: "no-store",
      });
      const payload = (await parseJsonResponse(response)) as ThakaaMedAnalysisResponse;

      if (!response.ok) {
        throw new Error(payload.error_message || payload.message || `Polling failed (${response.status}).`);
      }

      if (payload && typeof payload === "object" && "is_done" in payload) {
        return payload;
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Polling failed.");
    }
  }

  throw lastError ?? new Error("Unable to poll ThakaaMed analysis.");
}

function wait(delayMs: number) {
  return new Promise((resolve) => window.setTimeout(resolve, delayMs));
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
