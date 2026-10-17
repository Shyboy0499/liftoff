import type { Category, Medication, Plan, Restriction, Task } from "./schema";
import { minutesOfDay } from "./dates";

export type Slot = "morning" | "afternoon" | "evening" | "anytime";
export const SLOTS: Slot[] = ["morning", "afternoon", "evening", "anytime"];

export interface ChecklistItem {
  /** Unique within a day; combined with the day number for saved progress. */
  key: string;
  sourceId: string;
  kind: "dose" | "task";
  category: Category;
  title: string;
  detail: string;
  slot: Slot;
  time: string | null;
  /** Ticks needed to finish (e.g. 8 glasses of water). */
  count: number;
}

function activeOn(start: number, end: number | null, day: number, lastDay: number): boolean {
  return day >= start && day <= (end ?? lastDay);
}

function slotFor(time: string): Slot {
  const m = minutesOfDay(time) ?? 0;
  if (m < 12 * 60) return "morning";
  if (m < 17 * 60) return "afternoon";
  return "evening";
}

export function medActive(m: Medication, day: number, lastDay: number): boolean {
  return activeOn(m.startDay, m.endDay, day, lastDay);
}

export function taskActive(t: Task, day: number, lastDay: number): boolean {
  return activeOn(t.startDay, t.endDay, day, lastDay);
}

export function checklistFor(plan: Plan, day: number): ChecklistItem[] {
  const last = Math.max(plan.recoveryDays, 1);
  const items: ChecklistItem[] = [];

  for (const m of plan.medications) {
    if (!medActive(m, day, last)) continue;
    for (const time of m.times) {
      if (minutesOfDay(time) == null) continue;
      items.push({
        key: `${m.id}@${time}`,
        sourceId: m.id,
        kind: "dose",
        category: "medication",
        title: `${m.name} ${m.dose}`,
        detail: m.purpose,
        slot: slotFor(time),
        time,
        count: 1,
      });
    }
  }

  for (const t of plan.tasks) {
    if (!taskActive(t, day, last)) continue;
    items.push({
      key: t.id,
      sourceId: t.id,
      kind: "task",
      category: t.category,
      title: t.title,
      detail: t.detail,
      slot: t.timeOfDay,
      time: null,
      count: Math.min(Math.max(Math.round(t.timesPerDay) || 1, 1), 12),
    });
  }

  const order = (i: ChecklistItem) =>
    SLOTS.indexOf(i.slot) * 10_000 + (i.time ? (minutesOfDay(i.time) ?? 0) : 5_000);
  return items.sort((a, b) => order(a) - order(b));
}

export interface DoseTime {
  med: Medication;
  index: number;
  time: string;
  minutes: number;
}

/** Scheduled doses on a day, sorted by time. */
export function dosesOn(plan: Plan, day: number): DoseTime[] {
  const last = Math.max(plan.recoveryDays, 1);
  const out: DoseTime[] = [];
  plan.medications.forEach((med, index) => {
    if (!medActive(med, day, last)) return;
    for (const time of med.times) {
      const minutes = minutesOfDay(time);
      if (minutes != null) out.push({ med, index, time, minutes });
    }
  });
  return out.sort((a, b) => a.minutes - b.minutes);
}

export function nextDose(plan: Plan, day: number, nowMinutes: number): DoseTime | null {
  return dosesOn(plan, day).find((d) => d.minutes > nowMinutes) ?? null;
}

export interface RestrictionState {
  restriction: Restriction;
  active: boolean;
  daysLeft: number | null;
  /** 0..1 of the restriction period already behind you. */
  progress: number | null;
}

export function restrictionStates(plan: Plan, day: number): RestrictionState[] {
  return plan.restrictions.map((r) => {
    if (r.untilDay == null) {
      return { restriction: r, active: true, daysLeft: null, progress: null };
    }
    const daysLeft = r.untilDay - day;
    return {
      restriction: r,
      active: daysLeft > 0,
      daysLeft: Math.max(daysLeft, 0),
      progress: r.untilDay > 0 ? Math.min(Math.max(day / r.untilDay, 0), 1) : 1,
    };
  });
}
