const DAY_MS = 86_400_000;

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, days: number): Date {
  const out = startOfDay(d);
  out.setDate(out.getDate() + days);
  return out;
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parses "YYYY-MM-DD" as a local calendar date. */
export function fromISODate(s: string | null | undefined): Date | null {
  const m = s?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Whole calendar days from `from` to `to` (DST-safe). */
export function daysBetween(from: Date, to: Date): number {
  const a = startOfDay(from);
  const b = startOfDay(to);
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

export function minutesOfDay(hhmm: string): number | null {
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || min > 59) return null;
  return (h % 24) * 60 + min;
}

export function formatClock(hhmm: string, locale: string): string {
  const mins = minutesOfDay(hhmm);
  if (mins == null) return hhmm;
  const d = new Date(2000, 0, 1, Math.floor(mins / 60), mins % 60);
  return d.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
}

export function formatShortDate(d: Date, locale: string): string {
  return d.toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric" });
}
