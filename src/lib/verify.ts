import type { Plan } from "./schema";

// Source checking. Every item Claude returns carries a quote from the
// document; this module finds that quote in the original text with plain
// string matching. Nothing here asks the AI whether it was right: an item is
// "verified" only if its words really appear in the patient's papers.

export interface Span {
  start: number;
  end: number;
}

export type SourceKind =
  | "medication"
  | "task"
  | "restriction"
  | "milestone"
  | "warning"
  | "question";

export interface SourceRef {
  id: string;
  kind: SourceKind;
  label: string;
  quote: string;
  span: Span | null;
}

// Compare letters and digits only, so line breaks, bullet marks and curly vs
// straight quotes in the document don't hide a real match. `map[i]` is the
// index in the original text of the i-th kept character.
function normalize(text: string): { flat: string; map: number[] } {
  let flat = "";
  const map: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i].toLowerCase();
    if (/[\p{L}\p{N}]/u.test(ch)) {
      flat += ch;
      map.push(i);
    }
  }
  return { flat, map };
}

export function locate(doc: string, quote: string): Span | null {
  const q = normalize(quote).flat;
  if (q.length < 4) return null;
  const { flat, map } = normalize(doc);
  const at = flat.indexOf(q);
  if (at === -1) return null;
  return { start: map[at], end: map[at + q.length - 1] + 1 };
}

export function collectSources(plan: Plan): Omit<SourceRef, "span">[] {
  return [
    ...plan.medications.map((m) => ({
      id: m.id,
      kind: "medication" as const,
      label: `${m.name} ${m.dose}`,
      quote: m.quote,
    })),
    ...plan.tasks.map((t) => ({ id: t.id, kind: "task" as const, label: t.title, quote: t.quote })),
    ...plan.restrictions.map((r) => ({
      id: r.id,
      kind: "restriction" as const,
      label: r.title,
      quote: r.quote,
    })),
    ...plan.milestones.map((m) => ({
      id: m.id,
      kind: "milestone" as const,
      label: m.title,
      quote: m.quote,
    })),
    ...plan.warnings.map((w) => ({
      id: w.id,
      kind: "warning" as const,
      label: w.symptom,
      quote: w.quote,
    })),
    ...plan.questions.map((q) => ({
      id: q.id,
      kind: "question" as const,
      label: q.question,
      quote: q.quote,
    })),
  ];
}

export function verifyPlan(plan: Plan, doc: string): Map<string, SourceRef> {
  const out = new Map<string, SourceRef>();
  for (const s of collectSources(plan)) {
    out.set(s.id, { ...s, span: locate(doc, s.quote) });
  }
  return out;
}

/** Sources in the order their quotes appear in the document. */
export function inDocumentOrder(sources: Map<string, SourceRef>): SourceRef[] {
  return [...sources.values()].sort(
    (a, b) => (a.span?.start ?? Infinity) - (b.span?.start ?? Infinity),
  );
}
