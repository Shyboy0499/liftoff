import { useState } from "react";
import type { Plan, SymptomResult } from "../lib/schema";
import { useTrace, useUI } from "../lib/context";
import { checkSymptom, type AIMode } from "../lib/ai";
import { locate } from "../lib/verify";
import { AlertIcon, CheckIcon, CopyIcon, PhoneIcon } from "./Icons";
import { SourceChip } from "./SourceChip";

function CopyNumber({ label, number }: { label: string; number: string }) {
  const { t } = useUI();
  const [copied, setCopied] = useState(false);
  const copy = async (e: React.MouseEvent<HTMLButtonElement>) => {
    const target = e.currentTarget.parentElement?.querySelector(".phone-num");
    try {
      await navigator.clipboard.writeText(number);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard refused: select the number so it can be copied by hand.
      if (target) getSelection()?.selectAllChildren(target);
    }
  };
  return (
    <div className="phone">
      <PhoneIcon size={16} />
      <span className="phone-label">{label}</span>
      <span className="phone-num">{number}</span>
      <button type="button" className="icon-btn" onClick={copy} aria-label={`${t("copy")} ${number}`}>
        {copied ? <CheckIcon size={15} /> : <CopyIcon size={15} />}
      </button>
    </div>
  );
}

export function HelpPanel(props: { plan: Plan; doc: string; mode: AIMode }) {
  const { t } = useUI();
  const trace = useTrace();
  const { plan } = props;
  const [symptom, setSymptom] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SymptomResult | null>(null);

  const emergency = plan.warnings.filter((w) => w.level === "call_911");
  const doctor = plan.warnings.filter((w) => w.level === "call_doctor");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symptom.trim() || busy) return;
    setBusy(true);
    setResult(null);
    try {
      setResult(await checkSymptom(props.mode, plan, props.doc, symptom.trim()));
    } finally {
      setBusy(false);
    }
  };

  const quoteFound = result?.quote ? locate(props.doc, result.quote) : null;
  const matched = result?.warningId ? trace.sources.get(result.warningId) : undefined;

  return (
    <section className="card help" aria-labelledby="help-title">
      <header className="card-head">
        <h2 id="help-title" className="label">
          {t("help")}
        </h2>
      </header>

      <div className="alarm alarm-911">
        <h3>
          <AlertIcon size={18} /> {t("call911")}
        </h3>
        <ul>
          {emergency.map((w) => (
            <li key={w.id}>
              <span>{w.symptom}</span>
              <SourceChip id={w.id} compact />
            </li>
          ))}
        </ul>
      </div>

      <div className="alarm alarm-doctor">
        <h3>
          <PhoneIcon size={18} /> {t("callCare")}
        </h3>
        {plan.patient.careTeam && <p className="care-team">{plan.patient.careTeam}</p>}
        <div className="phones">
          {plan.patient.phone && <CopyNumber label={t("clinic")} number={plan.patient.phone} />}
          {plan.patient.afterHoursPhone && (
            <CopyNumber label={t("afterHours")} number={plan.patient.afterHoursPhone} />
          )}
        </div>
        <ul>
          {doctor.map((w) => (
            <li key={w.id}>
              <span>{w.symptom}</span>
              <SourceChip id={w.id} compact />
            </li>
          ))}
        </ul>
      </div>

      <form className="symptom" onSubmit={submit}>
        <label htmlFor="symptom-input" className="symptom-title">
          {t("symptomTitle")}
        </label>
        <div className="symptom-row">
          <input
            id="symptom-input"
            value={symptom}
            onChange={(e) => setSymptom(e.target.value)}
            placeholder={t("symptomPlaceholder")}
            autoComplete="off"
          />
          <button id="symptom-button" className="btn btn-dark" disabled={busy || !symptom.trim()}>
            {busy ? t("symptomChecking") : t("symptomButton")}
          </button>
        </div>

        {result && (
          <div className={`verdict verdict-${result.level}`} role="status">
            <p className="verdict-level">{t(`level_${result.level}`)}</p>
            <p>{result.message}</p>
            {result.level === "not_covered" && <p>{t("notCoveredAdvice")}</p>}
            {result.quote && quoteFound && (
              <blockquote>
                “{result.quote}”
                {matched && <SourceChip id={matched.id} />}
              </blockquote>
            )}
            {result.level === "call_doctor" && plan.patient.phone && (
              <CopyNumber label={t("clinic")} number={plan.patient.phone} />
            )}
          </div>
        )}
        <p className="fine">{t("symptomDisclaimer")}</p>
      </form>
    </section>
  );
}
