import type { Plan, SymptomResult } from "./schema";

// Offline symptom check, used when there is no AI connection. It only looks
// for overlap between what the patient typed and the warning signs written in
// their papers, and it errs toward "call".

const EMERGENCY = [
  "can't breathe",
  "cant breathe",
  "trouble breathing",
  "short of breath",
  "shortness of breath",
  "chest pain",
  "chest hurts",
  "fainted",
  "passed out",
  "heavy bleeding",
];

// Everyday words mapped to the words discharge papers tend to use.
const SYNONYMS: Record<string, string[]> = {
  red: ["redness", "red"],
  redness: ["redness", "red"],
  warm: ["warmth", "warm"],
  hot: ["warmth", "fever"],
  swollen: ["swelling"],
  puffy: ["swelling"],
  pus: ["pus", "drainage"],
  oozing: ["drainage", "pus"],
  leaking: ["drainage"],
  fever: ["fever"],
  temperature: ["fever"],
  chills: ["fever"],
  throw: ["vomiting"],
  threw: ["vomiting"],
  water: ["fluids", "drinking"],
  drink: ["fluids", "drinking"],
  fluids: ["fluids"],
  throwing: ["vomiting"],
  puke: ["vomiting"],
  puking: ["vomiting"],
  vomit: ["vomiting"],
  vomiting: ["vomiting"],
  nauseous: ["nausea"],
  sick: ["nausea"],
  poop: ["bowel"],
  pooped: ["bowel"],
  constipated: ["bowel"],
  breathe: ["breathing"],
  breath: ["breathing"],
  chest: ["chest"],
  stomach: ["belly"],
  tummy: ["belly"],
  belly: ["belly"],
  worse: ["worse"],
  hurts: ["pain"],
  pain: ["pain"],
  incision: ["incision"],
  cut: ["incision"],
  wound: ["incision"],
};

const STOP = new Set(
  "and the that with for you your are not has have had feel feels feeling felt look looks like very really kind bit little from this its but was been get gets got just more much some any".split(
    " ",
  ),
);

const words = (s: string) =>
  (s.toLowerCase().match(/[a-z]+/g) ?? []).filter((w) => w.length > 2 && !STOP.has(w));

export function matchSymptom(plan: Plan, text: string): SymptomResult {
  const lower = text.toLowerCase();
  const typed = new Set(words(text).flatMap((w) => SYNONYMS[w] ?? [w]));

  let best: { id: string; score: number } | null = null;
  for (const w of plan.warnings) {
    const target = new Set(words(`${w.symptom} ${w.quote}`));
    let score = 0;
    for (const t of typed) if (target.has(t)) score++;
    if (score > (best?.score ?? 0)) best = { id: w.id, score };
  }

  const warning = best ? plan.warnings.find((w) => w.id === best.id) : undefined;
  const emergency = EMERGENCY.some((p) => lower.includes(p));

  if (warning && (warning.level === "call_911" || !emergency)) {
    return {
      level: warning.level,
      warningId: warning.id,
      quote: warning.quote,
      message:
        warning.level === "call_911"
          ? "Your papers list this as an emergency sign. Call 911 or go to the nearest emergency room."
          : "Your papers list this as a reason to call your care team. Call them now and describe what you're seeing.",
    };
  }
  if (emergency) {
    return {
      level: "call_911",
      warningId: null,
      quote: null,
      message: "This could be an emergency. Call 911 or go to the nearest emergency room.",
    };
  }
  return {
    level: "not_covered",
    warningId: null,
    quote: null,
    message: "Your papers don't list this as a warning sign.",
  };
}
