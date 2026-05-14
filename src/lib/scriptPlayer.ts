import { LANGUAGE_META, type MentorLanguage } from "@/types/script";

interface SpeakTextOptions {
  text: string;
  language: MentorLanguage;
  rate: number;
  signal?: AbortSignal;
}

function rejectAbort() {
  return new DOMException("Playback aborted", "AbortError");
}

export function cancelSpeech() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return;
  }

  window.speechSynthesis.cancel();
}

export function pauseSpeech() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return;
  }

  window.speechSynthesis.pause();
}

export function resumeSpeech() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return;
  }

  window.speechSynthesis.resume();
}

export async function waitForVoices(): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return [];
  }

  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    return voices;
  }

  return await new Promise<SpeechSynthesisVoice[]>((resolve) => {
    const handleVoices = () => {
      window.speechSynthesis.removeEventListener("voiceschanged", handleVoices);
      resolve(window.speechSynthesis.getVoices());
    };

    window.speechSynthesis.addEventListener("voiceschanged", handleVoices, {
      once: true,
    });

    window.setTimeout(() => resolve(window.speechSynthesis.getVoices()), 1500);
  });
}

function pickVoice(language: MentorLanguage, voices: SpeechSynthesisVoice[]) {
  const locale = LANGUAGE_META[language].locale.toLowerCase();
  return (
    voices.find((voice) => voice.lang.toLowerCase() === locale) ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith(locale.split("-")[0])) ??
    null
  );
}

export async function speakText({
  text,
  language,
  rate,
  signal,
}: SpeakTextOptions): Promise<void> {
  if (!text.trim()) {
    return;
  }

  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return;
  }

  if (signal?.aborted) {
    throw rejectAbort();
  }

  const voices = await waitForVoices();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = LANGUAGE_META[language].locale;
  utterance.rate = rate;

  const voice = pickVoice(language, voices);
  if (voice) {
    utterance.voice = voice;
  }

  await new Promise<void>((resolve, reject) => {
    const abortPlayback = () => {
      cancelSpeech();
      reject(rejectAbort());
    };

    utterance.onend = () => {
      signal?.removeEventListener("abort", abortPlayback);
      resolve();
    };

    utterance.onerror = () => {
      signal?.removeEventListener("abort", abortPlayback);
      reject(new Error("Speech synthesis failed."));
    };

    signal?.addEventListener("abort", abortPlayback, { once: true });
    window.speechSynthesis.speak(utterance);
  });
}
