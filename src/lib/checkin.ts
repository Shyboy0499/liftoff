import type { Plan } from "./schema";

// Daily check-ins and the rules that turn them into alerts. Rules come from
// the warning signs written in the papers (their original quotes), and the
// checks are plain comparisons: no AI decides whether something is a problem.

export interface CheckIn {
  pain: number | null;
  /** Always stored in °F. */
  tempF: number | null;
  bowel: "yes" | "no" | null;
}

export type CheckInLog = Record<number, CheckIn>;

export const EMPTY_CHECKIN: CheckIn = { pain: null, tempF: null, bowel: null };

export interface Rules {
  fever: { warningId: string; maxF: number } | null;
  pain: { warningId: string } | null;
  bowel: { warningId: string; days: number } | null;
}

export const cToF = (c: number) => (c * 9) / 5 + 32;
export const fToC = (f: number) => ((f - 32) * 5) / 9;

export function rulesFromPlan(plan: Plan): Rules {
  const rules: Rules = { fever: null, pain: null, bowel: null };
  for (const w of plan.warnings) {
    if (w.level !== "call_doctor") continue;
    const text = w.quote;
    const f = text.match(/(\d{2,3}(?:\.\d+)?)\s*°?\s*F\b/i);
    const c = text.match(/(\d{2}(?:\.\d+)?)\s*°?\s*C\b/i);
    if (!rules.fever && /fever|temperature/i.test(text) && (f || c)) {
      rules.fever = { warningId: w.id, maxF: f ? Number(f[1]) : cToF(Number(c![1])) };
    } else if (!rules.pain && /\bpain\b/i.test(text) && /\b(worse|increas\w*)\b/i.test(text)) {
      rules.pain = { warningId: w.id };
    } else if (!rules.bowel && /bowel movement/i.test(text)) {
      const days = text.match(/(\d+)\s*days?/i);
      if (days) rules.bowel = { warningId: w.id, days: Number(days[1]) };
    }
  }
  return rules;
}

export interface Flag {
  kind: "fever" | "pain" | "bowel";
  day: number;
  warningId: string;
  /** Numbers the alert text needs. */
  tempF?: number;
  maxF?: number;
  days?: number;
}

/** All alerts raised by the log, oldest first. */
export function flagsFor(log: CheckInLog, rules: Rules): Flag[] {
  const days = Object.keys(log)
    .map(Number)
    .sort((a, b) => a - b);
  const flags: Flag[] = [];

  for (const day of days) {
    const entry = log[day];

    if (rules.fever && entry.tempF != null && entry.tempF > rules.fever.maxF) {
      flags.push({ kind: "fever", day, warningId: rules.fever.warningId, tempF: entry.tempF, maxF: rules.fever.maxF });
    }

    // "Pain that gets worse": up two check-ins in a row, or up 3+ points at once.
    if (rules.pain && entry.pain != null) {
      const earlier = days.filter((d) => d < day && log[d].pain != null);
      const prev = earlier.at(-1);
      const prev2 = earlier.at(-2);
      const p0 = prev != null ? log[prev].pain! : null;
      const p1 = prev2 != null ? log[prev2].pain! : null;
      const upTwice = p0 != null && p1 != null && entry.pain > p0 && p0 > p1;
      const jump = p0 != null && entry.pain - p0 >= 3;
      if (upTwice || jump) flags.push({ kind: "pain", day, warningId: rules.pain.warningId });
    }

    // "No bowel movement for N days": N answered "No"s in a row, ending today.
    if (rules.bowel && entry.bowel === "no") {
      let run = 0;
      for (let d = day; log[d]?.bowel === "no"; d--) run++;
      if (run >= rules.bowel.days) {
        flags.push({ kind: "bowel", day, warningId: rules.bowel.warningId, days: run });
      }
    }
  }
  return flags;
}
