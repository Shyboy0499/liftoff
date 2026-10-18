import { useEffect, useRef, useState } from "react";
import type { Plan } from "../lib/schema";
import { fToC, type CheckInLog, type Flag } from "../lib/checkin";
import { useUI } from "../lib/context";
import { addDays, formatShortDate } from "../lib/dates";
import { checklistFor } from "../lib/schedule";
import type { Progress } from "./Checklist";
import { CheckIcon, CloseIcon, CopyIcon } from "./Icons";

/** A one-page summary of the recovery so far, to bring to the follow-up visit. */
export function VisitSummary(props: {
  plan: Plan;
  today: number;
  discharge: Date;
  log: CheckInLog;
  flags: Flag[];
  progress: Record<number, Progress>;
  onClose: () => void;
}) {
  const { t, locale } = useUI();
  const { plan } = props;
  const [copied, setCopied] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onClose = useRef(props.onClose);
  onClose.current = props.onClose;
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose.current();
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  const unit = (() => {
    try {
      return JSON.parse(localStorage.getItem("liftoff:unit") ?? '"F"') === "C" ? "C" : "F";
    } catch {
      return "F";
    }
  })();
  const temp = (f: number | null) =>
    f == null ? "—" : `${+(unit === "F" ? f : fToC(f)).toFixed(1)}°${unit}`;

  const rows = Array.from({ length: props.today + 1 }, (_, day) => {
    const entry = props.log[day];
    const doses = checklistFor(plan, day).filter((i) => i.kind === "dose");
    const done = doses.filter((i) => (props.progress[day]?.[i.key] ?? 0) > 0).length;
    const flags = props.flags.filter((f) => f.day === day);
    return {
      day,
      date: formatShortDate(addDays(props.discharge, day), locale),
      pain: entry?.pain != null ? `${entry.pain}/10` : "—",
      temp: temp(entry?.tempF ?? null),
      bowel: entry?.bowel ? t(entry.bowel) : "—",
      doses: doses.length ? `${done}/${doses.length}` : "—",
      flags: flags.map((f) => plan.warnings.find((w) => w.id === f.warningId)?.symptom ?? f.kind),
    };
  });
  const raised = rows.flatMap((r) => r.flags.map((f) => ({ day: r.day, date: r.date, text: f })));

  const asText = () =>
    [
      `${t("summaryTitle")} — ${plan.patient.name ?? ""}`,
      [plan.patient.procedure, t("dayOf", { d: props.today, n: Math.max(plan.recoveryDays, 1) })].filter(Boolean).join(" · "),
      "",
      [t("colDay"), t("colDate"), t("colPain"), t("colTemp"), t("colBowel"), t("colDoses")].join(" | "),
      ...rows.map((r) => [r.day, r.date, r.pain, r.temp, r.bowel, r.doses].join(" | ")),
      "",
      `${t("summaryFlags")}:`,
      ...(raised.length ? raised.map((f) => `- ${t("dayLabel", { d: f.day })} (${f.date}): ${f.text}`) : [t("summaryNoFlags")]),
      "",
      `${t("summaryQuestions")}:`,
      ...plan.questions.map((q) => `- ${q.question}`),
    ].join("\n");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(asText());
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      const el = document.getElementById("visit-summary-body");
      if (el) getSelection()?.selectAllChildren(el);
    }
  };

  return (
    <div className="visit-backdrop" onClick={(e) => e.target === e.currentTarget && props.onClose()}>
      <div className="visit-modal" role="dialog" aria-modal="true" aria-labelledby="visit-title">
        <header className="visit-head">
          <div>
            <h2 id="visit-title">{t("summaryTitle")}</h2>
            <p className="muted">
              <strong>{plan.patient.name}</strong>
              {plan.patient.procedure && <> · {plan.patient.procedure}</>} ·{" "}
              {t("dayOf", { d: props.today, n: Math.max(plan.recoveryDays, 1) })}
            </p>
          </div>
          <div className="visit-actions">
            <button type="button" className="btn btn-ghost btn-small" onClick={copy}>
              {copied ? <CheckIcon size={15} /> : <CopyIcon size={15} />} {copied ? t("copied") : t("copySummary")}
            </button>
            {!__ARTIFACT__ && (
              <button type="button" className="btn btn-ghost btn-small" onClick={() => print()}>
                {t("printSummary")}
              </button>
            )}
            <button ref={closeRef} type="button" className="icon-btn" onClick={props.onClose} aria-label={t("close")}>
              <CloseIcon size={18} />
            </button>
          </div>
        </header>

        <div id="visit-summary-body" className="visit-body">
          <div className="table-wrap">
            <table className="visit-table">
              <thead>
                <tr>
                  <th>{t("colDay")}</th>
                  <th>{t("colDate")}</th>
                  <th>{t("colPain")}</th>
                  <th>{t("colTemp")}</th>
                  <th>{t("colBowel")}</th>
                  <th>{t("colDoses")}</th>
                  <th>{t("colFlags")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.day} className={r.flags.length ? "is-flagged" : ""}>
                    <td>{r.day}</td>
                    <td>{r.date}</td>
                    <td>{r.pain}</td>
                    <td>{r.temp}</td>
                    <td>{r.bowel}</td>
                    <td>{r.doses}</td>
                    <td>{r.flags.join("; ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="visit-cols">
            <section>
              <h3 className="label">{t("summaryFlags")}</h3>
              {raised.length ? (
                <ul>
                  {raised.map((f, i) => (
                    <li key={i}>
                      <b>{t("dayLabel", { d: f.day })}</b> · {f.date}: {f.text}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">{t("summaryNoFlags")}</p>
              )}
            </section>
            <section>
              <h3 className="label">{t("summaryQuestions")}</h3>
              <ul>
                {plan.questions.map((q) => (
                  <li key={q.id}>{q.question}</li>
                ))}
              </ul>
            </section>
          </div>
          <p className="fine">{t("summaryIntro")}</p>
        </div>
      </div>
    </div>
  );
}
