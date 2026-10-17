import type { Plan } from "../lib/schema";
import { useUI } from "../lib/context";
import { formatClock } from "../lib/dates";
import { SLOTS, type ChecklistItem } from "../lib/schedule";
import { SLOT_KEYS, toneForCategory } from "../lib/tones";
import { CheckIcon, RocketGlyph } from "./Icons";
import { SourceChip } from "./SourceChip";

export type Progress = Record<string, number>;

export function Checklist(props: {
  plan: Plan;
  day: number;
  isToday: boolean;
  items: ChecklistItem[];
  progress: Progress;
  onProgress: (key: string, value: number) => void;
}) {
  const { t, locale } = useUI();
  const total = props.items.reduce((n, i) => n + i.count, 0);
  const done = props.items.reduce((n, i) => n + Math.min(props.progress[i.key] ?? 0, i.count), 0);
  const editable = props.isToday;
  const withFood = new Set(props.plan.medications.filter((m) => m.withFood).map((m) => m.id));

  return (
    <section className="card checklist" aria-labelledby="checklist-title">
      <header className="card-head">
        <h2 id="checklist-title" className="label">
          {props.isToday ? t("checklist") : t("checklistFor", { d: props.day })}
        </h2>
        <span className="meta">{t("doneCount", { done, total })}</span>
      </header>

      <div className={`fuel ${done === total && total > 0 ? "is-full" : ""}`} aria-hidden>
        <div className="fuel-cells">
          {Array.from({ length: total }, (_, i) => (
            <span key={i} className={i < done ? "on" : ""} />
          ))}
        </div>
        <RocketGlyph size={22} className="fuel-rocket" />
      </div>

      {SLOTS.map((slot) => {
        const items = props.items.filter((i) => i.slot === slot);
        if (!items.length) return null;
        return (
          <div key={slot} className="slot">
            <h3 className="slot-name">{t(SLOT_KEYS[slot])}</h3>
            <ul>
              {items.map((item) => {
                const value = Math.min(props.progress[item.key] ?? 0, item.count);
                const complete = value >= item.count;
                const tone = toneForCategory(item.category);
                return (
                  <li key={item.key} className={`task ${complete ? "is-done" : ""}`} data-key={item.key}>
                    {item.count === 1 ? (
                      <button
                        type="button"
                        className={`tick tone-${tone}`}
                        role="checkbox"
                        aria-checked={complete}
                        aria-label={item.title}
                        disabled={!editable}
                        onClick={() => props.onProgress(item.key, complete ? 0 : 1)}
                      >
                        {complete && <CheckIcon size={15} />}
                      </button>
                    ) : (
                      <span className={`tick tick-count tone-${tone}`} aria-hidden>
                        {value}
                      </span>
                    )}
                    <div className="task-main">
                      <p className="task-title">
                        {item.time && <time className="task-time">{formatClock(item.time, locale)}</time>}
                        {item.title}
                      </p>
                      <p className="task-detail">
                        {item.detail}
                        {item.kind === "dose" && withFood.has(item.sourceId) && <> · {t("withFood")}</>}
                      </p>
                      {item.count > 1 && (
                        <div className="pips" role="group" aria-label={item.title}>
                          {Array.from({ length: item.count }, (_, i) => (
                            <button
                              key={i}
                              type="button"
                              className={`pip tone-${tone} ${i < value ? "on" : ""}`}
                              aria-label={`${i + 1} / ${item.count}`}
                              aria-pressed={i < value}
                              disabled={!editable}
                              onClick={() => props.onProgress(item.key, i < value ? i : i + 1)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                    <SourceChip id={item.sourceId} compact />
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
