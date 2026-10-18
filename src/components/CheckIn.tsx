import { useEffect, useState } from "react";
import type { Plan } from "../lib/schema";
import { EMPTY_CHECKIN, cToF, fToC, type CheckIn, type CheckInLog, type Flag, type Rules } from "../lib/checkin";
import { usePersistentState, useTrace, useUI } from "../lib/context";
import { AlertIcon, DocIcon, PhoneIcon } from "./Icons";
import { PainChart, TempChart, type TempUnit } from "./LogCharts";
import { SourceChip } from "./SourceChip";

export function CheckInCard(props: {
  plan: Plan;
  day: number;
  today: number;
  discharge: Date;
  log: CheckInLog;
  rules: Rules;
  flags: Flag[];
  isSample: boolean;
  onChange: (day: number, entry: CheckIn) => void;
  onOpenSummary: () => void;
}) {
  const { t } = useUI();
  const trace = useTrace();
  const [unit, setUnit] = usePersistentState<TempUnit>("liftoff:unit", "F");
  const entry = props.log[props.day] ?? EMPTY_CHECKIN;
  const editable = props.day <= props.today;
  const set = (patch: Partial<CheckIn>) => props.onChange(props.day, { ...entry, ...patch });

  // The temperature box keeps its own text so typing "99." isn't fought.
  const shown = (f: number | null) => (f == null ? "" : String(+(unit === "F" ? f : fToC(f)).toFixed(1)));
  const [tempText, setTempText] = useState(shown(entry.tempF));
  // Re-sync only when the day or unit changes, not on every keystroke.
  useEffect(() => setTempText(shown(entry.tempF)), [props.day, unit]);
  const onTemp = (text: string) => {
    setTempText(text);
    const v = Number(text);
    if (text.trim() === "") return set({ tempF: null });
    const f = unit === "F" ? v : cToF(v);
    if (Number.isFinite(v) && f >= 90 && f <= 110) set({ tempF: Math.round(f * 10) / 10 });
  };

  const dayFlags = props.flags.filter((f) => f.day === props.day);
  const fmtTemp = (f: number) => `${+(unit === "F" ? f : fToC(f)).toFixed(1)}°${unit}`;
  const message = (f: Flag) =>
    f.kind === "fever"
      ? t("alertFever", { v: fmtTemp(f.tempF!), limit: fmtTemp(f.maxF!) })
      : f.kind === "pain"
        ? t("alertPain")
        : t("alertBowel", { n: f.days! });
  const tempSource = props.rules.fever?.warningId;

  return (
    <section className="card checkin" aria-labelledby="checkin-title">
      <header className="card-head">
        <h2 id="checkin-title" className="label">
          {props.day === props.today ? t("checkinTitle") : t("checkinFor", { d: props.day })}
        </h2>
        <button type="button" id="summary-button" className="btn btn-ghost btn-small" onClick={props.onOpenSummary}>
          <DocIcon size={15} /> {t("visitSummary")}
        </button>
      </header>

      {dayFlags.map((f) => {
        const warning = props.plan.warnings.find((w) => w.id === f.warningId);
        return (
          <div key={`${f.kind}-${f.day}`} className="checkin-alert" role="alert">
            <AlertIcon size={20} />
            <div className="checkin-alert-main">
              <p className="checkin-alert-title">{message(f)}</p>
              <p>{t("alertCall")}</p>
              {warning && (
                <blockquote>
                  “{warning.quote}” <SourceChip id={warning.id} />
                </blockquote>
              )}
            </div>
            {props.plan.patient.phone && (
              <div className="phone">
                <PhoneIcon size={16} />
                <span className="phone-label">{t("clinic")}</span>
                <span className="phone-num">{props.plan.patient.phone}</span>
              </div>
            )}
          </div>
        );
      })}

      <div className="checkin-body">
        <div className="checkin-inputs">
          <fieldset className="field" disabled={!editable}>
            <legend>{t("painLabel")}</legend>
            <div className="pain-scale" role="radiogroup" aria-label={t("painLabel")}>
              {Array.from({ length: 11 }, (_, v) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={entry.pain === v}
                  className={`pain-step ${entry.pain === v ? "is-on" : ""}`}
                  style={{ ["--level" as string]: v / 10 }}
                  onClick={() => set({ pain: entry.pain === v ? null : v })}
                >
                  {v}
                </button>
              ))}
            </div>
            <div className="pain-ends">
              <span>{t("painNone")}</span>
              <span>{t("painWorst")}</span>
            </div>
          </fieldset>

          <div className="field-row">
            <fieldset className="field" disabled={!editable}>
              <legend>{t("tempLabel")}</legend>
              <div className="temp-input">
                <input
                  id="temp-input"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={tempText}
                  placeholder={unit === "F" ? t("tempPlaceholder") : "37.3"}
                  onChange={(e) => onTemp(e.target.value)}
                  aria-label={t("tempLabel")}
                />
                <div className="unit-toggle" role="group" aria-label="Unit">
                  {(["F", "C"] as const).map((u) => (
                    <button key={u} type="button" aria-pressed={unit === u} onClick={() => setUnit(u)}>
                      °{u}
                    </button>
                  ))}
                </div>
              </div>
            </fieldset>

            <fieldset className="field" disabled={!editable}>
              <legend>{t("bowelLabel")}</legend>
              <div className="yesno" role="radiogroup" aria-label={t("bowelLabel")}>
                {(["yes", "no"] as const).map((v) => (
                  <button
                    key={v}
                    id={`bowel-${v}`}
                    type="button"
                    role="radio"
                    aria-checked={entry.bowel === v}
                    onClick={() => set({ bowel: entry.bowel === v ? null : v })}
                  >
                    {t(v)}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
          {props.isSample && <p className="fine">{t("sampleLogNote")}</p>}
        </div>

        <figure className="log-figure">
          <figcaption className="log-title">{t("painChart")}</figcaption>
          <PainChart log={props.log} today={props.today} selectedDay={props.day} discharge={props.discharge} />
        </figure>
        <figure className="log-figure">
          <figcaption className="log-title">
            {t("tempChart")}
            {tempSource && trace.sources.get(tempSource) && <SourceChip id={tempSource} />}
          </figcaption>
          <TempChart
            log={props.log}
            today={props.today}
            selectedDay={props.day}
            discharge={props.discharge}
            maxF={props.rules.fever?.maxF ?? null}
            unit={unit}
          />
        </figure>
      </div>
    </section>
  );
}
