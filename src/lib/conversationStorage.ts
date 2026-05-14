export interface ConversationTurn {
  role: "user" | "assistant";
  text: string;
  at: number;
}

const STORAGE_KEY = "dentalmentor:conversation:v1";
// Keeps only compact transcript history to limit localStorage footprint.
export const MAX_CONVERSATION_TURNS = 40;

function isConversationTurn(input: unknown): input is ConversationTurn {
  if (!input || typeof input !== "object") {
    return false;
  }

  const record = input as Record<string, unknown>;
  return (
    (record.role === "user" || record.role === "assistant") &&
    typeof record.text === "string" &&
    typeof record.at === "number"
  );
}

export function readConversationTurns(): ConversationTurn[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isConversationTurn);
  } catch {
    return [];
  }
}

export function writeConversationTurns(turns: ConversationTurn[]) {
  if (typeof window === "undefined") {
    return;
  }

  const compactTurns = turns.slice(-MAX_CONVERSATION_TURNS).map((turn) => ({
    role: turn.role,
    text: turn.text.trim(),
    at: turn.at,
  }));

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(compactTurns));
}
