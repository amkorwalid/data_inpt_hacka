export type MentorLanguage = "en" | "fr" | "ar";
export type HighlightColor = "red" | "yellow" | "green" | "blue";
export type CanvasToolName =
  | "zoom_to_tooth"
  | "highlight_region"
  | "annotate"
  | "reset_view";

export const LANGUAGE_META: Record<
  MentorLanguage,
  { label: string; locale: string; direction: "ltr" | "rtl" }
> = {
  en: { label: "English", locale: "en-US", direction: "ltr" },
  fr: { label: "Français", locale: "fr-FR", direction: "ltr" },
  ar: { label: "العربية", locale: "ar-MA", direction: "rtl" },
};

export interface SpeakEvent {
  type: "speak";
  text: string;
}

export interface CanvasEvent {
  type: "canvas";
  tool: CanvasToolName;
  input: {
    tooth_id?: string;
    color?: HighlightColor;
    opacity?: number;
    label?: string;
    durationMs?: number;
  };
}

export type ScriptEvent = SpeakEvent | CanvasEvent;
