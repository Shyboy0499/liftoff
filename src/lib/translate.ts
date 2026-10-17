import type { Plan } from "./schema";

// Translation works on a flat list of strings so one Claude call can translate
// the interface text and the plan together, and the result maps back by
// position. Quotes stay in the original language on purpose: they are the
// patient's real papers.

type Row = Record<string, unknown>;

const FIELDS: Record<string, string[]> = {
  medications: ["name", "dose", "purpose", "limit", "note"],
  tasks: ["title", "detail"],
  restrictions: ["title", "condition"],
  milestones: ["title"],
  warnings: ["symptom"],
  questions: ["question"],
};

function slots(plan: Plan): { get: () => string; set: (v: string) => void }[] {
  const out: { get: () => string; set: (v: string) => void }[] = [];
  const add = (obj: Row, key: string) => {
    if (typeof obj[key] === "string" && obj[key]) {
      out.push({ get: () => obj[key] as string, set: (v) => (obj[key] = v) });
    }
  };
  add(plan as unknown as Row, "summary");
  add(plan.patient as unknown as Row, "procedure");
  for (const [list, keys] of Object.entries(FIELDS)) {
    for (const row of (plan as unknown as Record<string, Row[]>)[list]) {
      for (const k of keys) add(row, k);
    }
  }
  return out;
}

export function planStrings(plan: Plan): string[] {
  return slots(plan).map((s) => s.get());
}

export function applyPlanStrings(plan: Plan, strings: string[]): Plan {
  const copy: Plan = structuredClone(plan);
  const s = slots(copy);
  if (strings.length !== s.length) {
    throw new Error(`Expected ${s.length} translated strings, got ${strings.length}`);
  }
  s.forEach((slot, i) => slot.set(strings[i]));
  return copy;
}
