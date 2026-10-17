import type { Category, Plan } from "./schema";
import type { SourceRef } from "./verify";
import type { UIKey } from "./i18n";

// Color families used for highlights on the papers and markers in the plan.
export type Tone = "med" | "wound" | "activity" | "diet" | "followup" | "limit" | "warning" | "question";

export const TONES: Tone[] = ["med", "wound", "activity", "diet", "followup", "limit", "warning", "question"];

export function toneForCategory(c: Category): Tone {
  return c === "medication" ? "med" : c;
}

export function toneForSource(plan: Plan, ref: Pick<SourceRef, "id" | "kind">): Tone {
  switch (ref.kind) {
    case "medication":
      return "med";
    case "task":
      return toneForCategory(plan.tasks.find((t) => t.id === ref.id)?.category ?? "activity");
    case "restriction":
    case "milestone":
      return "limit";
    case "warning":
      return "warning";
    case "question":
      return "question";
  }
}

export const MED_COLORS = ["var(--m1)", "var(--m2)", "var(--m3)", "var(--m4)", "var(--m5)"];

export const SLOT_KEYS: Record<string, UIKey> = {
  morning: "morning",
  afternoon: "afternoon",
  evening: "evening",
  anytime: "anytime",
};
