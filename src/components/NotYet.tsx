import { useState } from "react";
import type { Plan } from "../lib/schema";
import { useUI } from "../lib/context";
import { addDays, formatShortDate } from "../lib/dates";
import { restrictionStates } from "../lib/schedule";
import { CheckIcon, CopyIcon } from "./Icons";
import { SourceChip } from "./SourceChip";

export function NotYet(props: { plan: Plan; day: number; discharge: Date }) {
  const { t, locale } = useUI();
  const states = restrictionStates(props.plan, props.day).filter((s) => s.active);
  if (!states.length) return null;
  return (
    <section className="card not-yet" aria-labelledby="notyet-title">
      <header className="card-head">
        <h2 id="notyet-title" className="label">
          {t("notYet")}
        </h2>
      </header>
      <ul className="limits">
        {states.map(({ restriction: r, daysLeft, progress }) => (
          <li key={r.id} className="limit">
            <div className="limit-count">
              {daysLeft != null ? (
                <>
                  <b>{daysLeft}</b>
                  <span>{daysLeft === 1 ? t("dayUnit") : t("daysUnit")}</span>
                </>
              ) : (
                <b className="limit-if">?</b>
              )}
            </div>
            <div className="limit-main">
              <p className="limit-title">{r.title}</p>
              {r.untilDay != null ? (
                <p className="limit-when">
                  {t("okFromDay", { d: r.untilDay })} · {formatShortDate(addDays(props.discharge, r.untilDay), locale)}
                </p>
              ) : (
                <p className="limit-when">{r.condition}</p>
              )}
              {progress != null && (
                <div className="limit-bar">
                  <span style={{ width: `${progress * 100}%` }} />
                </div>
              )}
            </div>
            <SourceChip id={r.id} compact />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Questions(props: { plan: Plan }) {
  const { t } = useUI();
  const [copied, setCopied] = useState(false);
  if (!props.plan.questions.length) return null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(props.plan.questions.map((q) => `• ${q.question}`).join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      const list = document.getElementById("question-list");
      if (list) getSelection()?.selectAllChildren(list);
    }
  };
  return (
    <section className="card questions" aria-labelledby="questions-title">
      <header className="card-head">
        <h2 id="questions-title" className="label">
          {t("questions")}
        </h2>
        <button type="button" className="btn btn-ghost btn-small" onClick={copy}>
          {copied ? <CheckIcon size={15} /> : <CopyIcon size={15} />} {copied ? t("copied") : t("copyQuestions")}
        </button>
      </header>
      <p className="fine">{t("questionsHint")}</p>
      <ul id="question-list" className="q-list">
        {props.plan.questions.map((q) => (
          <li key={q.id}>
            <span className="q-mark">?</span>
            <span className="q-text">{q.question}</span>
            <SourceChip id={q.id} compact />
          </li>
        ))}
      </ul>
    </section>
  );
}
