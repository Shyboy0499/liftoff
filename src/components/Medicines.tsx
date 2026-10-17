import type { Plan } from "../lib/schema";
import { useUI } from "../lib/context";
import { formatClock } from "../lib/dates";
import { dosesOn, medActive, nextDose } from "../lib/schedule";
import { MED_COLORS } from "../lib/tones";
import { SourceChip } from "./SourceChip";
import type { Progress } from "./Checklist";

const R_OUTER = 104;
const angleFor = (minutes: number) => (minutes / 1440) * 2 * Math.PI - Math.PI / 2;
const polar = (r: number, minutes: number) => ({
  x: Math.cos(angleFor(minutes)) * r,
  y: Math.sin(angleFor(minutes)) * r,
});

function arc(r: number, fromMin: number, toMin: number) {
  const a = polar(r, fromMin);
  const b = polar(r, toMin);
  const span = (toMin - fromMin + 1440) % 1440;
  return `M${a.x},${a.y}A${r},${r} 0 ${span > 720 ? 1 : 0} 1 ${b.x},${b.y}`;
}

function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h} h ${m} min` : `${m} min`;
}

export function Medicines(props: {
  plan: Plan;
  day: number;
  isToday: boolean;
  nowMinutes: number;
  progress: Progress;
}) {
  const { t, locale } = useUI();
  const { plan, day } = props;
  const last = Math.max(plan.recoveryDays, 1);
  const doses = dosesOn(plan, day);
  const lanes = [...new Set(doses.map((d) => d.index))];
  const laneR = (index: number) => 76 - lanes.indexOf(index) * 15;
  const next = props.isToday ? nextDose(plan, day, props.nowMinutes) : null;
  const now = polar(R_OUTER + 4, props.nowMinutes);

  return (
    <section className="card medicines" aria-labelledby="meds-title">
      <header className="card-head">
        <h2 id="meds-title" className="label">
          {t("medicines")}
        </h2>
      </header>

      <div className="clock-wrap">
        <svg viewBox="-128 -128 256 256" className="pill-clock" role="img" aria-label="24-hour medicine clock">
          <circle r={R_OUTER} className="clock-face" />
          <path d={arc(R_OUTER - 9, 22 * 60, 7 * 60)} className="clock-night" />
          {Array.from({ length: 24 }, (_, h) => {
            const a = polar(R_OUTER, h * 60);
            const b = polar(R_OUTER - (h % 6 === 0 ? 12 : 6), h * 60);
            return <line key={h} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={h % 6 ? "hour" : "hour major"} />;
          })}
          {[0, 6, 12, 18].map((h) => {
            const p = polar(R_OUTER + 15, h * 60);
            return (
              <text key={h} x={p.x} y={p.y + 4} textAnchor="middle" className="clock-num">
                {String(h).padStart(2, "0")}
              </text>
            );
          })}
          {lanes.map((index) => (
            <circle key={index} r={laneR(index)} className="lane" style={{ stroke: MED_COLORS[index % 5] }} />
          ))}
          {doses.map((d) => {
            const p = polar(laneR(d.index), d.minutes);
            const taken = (props.progress[`${d.med.id}@${d.time}`] ?? 0) > 0;
            const isNext = next?.med.id === d.med.id && next.time === d.time;
            return (
              <g key={`${d.med.id}@${d.time}`} className={`dose ${taken ? "is-taken" : ""} ${isNext ? "is-next" : ""}`}>
                <circle cx={p.x} cy={p.y} r={8} style={{ stroke: MED_COLORS[d.index % 5], fill: taken ? MED_COLORS[d.index % 5] : undefined }} />
                <title>{`${d.med.name} ${d.med.dose} · ${formatClock(d.time, locale)}`}</title>
              </g>
            );
          })}
          {props.isToday && (
            <g className="clock-hand">
              <line x1={0} y1={0} x2={now.x} y2={now.y} />
              <circle cx={now.x} cy={now.y} r={4} />
              <circle r={4} />
            </g>
          )}
        </svg>
        <div className="next-dose">
          <span className="label">{t("nextDose")}</span>
          {next ? (
            <>
              <strong>
                {next.med.name} {next.med.dose}
              </strong>
              <span>
                {formatClock(next.time, locale)} · {t("inTime", { t: formatDuration(next.minutes - props.nowMinutes) })}
              </span>
            </>
          ) : (
            <span className="muted">{props.isToday ? t("noMoreDoses") : "—"}</span>
          )}
        </div>
      </div>

      <ul className="med-list">
        {plan.medications.map((m, i) => {
          const active = medActive(m, day, last);
          return (
            <li key={m.id} className={`med ${active ? "" : "is-inactive"}`}>
              <span className="swatch" style={{ background: MED_COLORS[i % 5] }} />
              <div className="med-main">
                <p className="med-name">
                  {m.name} <span>{m.dose}</span>
                </p>
                <p className="med-purpose">{m.purpose}</p>
                <p className="med-when">
                  {m.asNeeded ? (
                    <>
                      <b>{t("asNeeded")}</b>
                      {m.limit && <> · {m.limit}</>}
                    </>
                  ) : (
                    <>
                      <b>{t("timesADay", { n: m.times.length })}</b> ·{" "}
                      {m.times.map((tm) => formatClock(tm, locale)).join(", ")}
                      {m.withFood && <> · {t("withFood")}</>}
                      {m.endDay != null && <> · {t("untilDay", { d: m.endDay })}</>}
                    </>
                  )}
                </p>
                {m.note && !m.asNeeded && m.endDay == null && <p className="med-note">{m.note}</p>}
              </div>
              <SourceChip id={m.id} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
