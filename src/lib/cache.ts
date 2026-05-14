import type { ThakaaMedAnalysisResponse } from "@/types/thakaamed";

const CACHE_PREFIX = "dentalmentor-analysis:";

function getCacheKey(hash: string) {
  return `${CACHE_PREFIX}${hash}`;
}

export async function hashFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export function readCachedAnalysis(hash: string): ThakaaMedAnalysisResponse | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(getCacheKey(hash));
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as ThakaaMedAnalysisResponse;
  } catch {
    window.localStorage.removeItem(getCacheKey(hash));
    return null;
  }
}

export function writeCachedAnalysis(hash: string, analysis: ThakaaMedAnalysisResponse) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(getCacheKey(hash), JSON.stringify(analysis));
}
