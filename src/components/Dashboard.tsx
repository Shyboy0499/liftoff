import { useEffect, useMemo, useRef, useState } from "react";
import type { Plan } from "../lib/schema";
import type { AIMode } from "../lib/ai";
import { useNow, usePersistentState, useTrace, useUI } from "../lib/context";
import { addDays, daysBetween, formatClock, formatShortDate, fromISODate } from "../lib/dates";
import { LANGUAGES } from "../lib/i18n";
import { checklistFor } from "../lib/schedule";
import { Checklist, type Progress } from "./Checklist";
import { FlightProfile } from "./FlightProfile";
import { HelpPanel } from "./HelpPanel";
import { DocIcon, GlobeIcon, RocketGlyph, SpeakerIcon, StopIcon } from "./Icons";
import { Medicines } from "./Medicines";
import { NotYet, Questions } from "./NotYet";
import { PapersPanel, TraceLayer } from "./PapersPanel";
import type { PaperSource } from "./Paper";

function planKey(plan: Plan, doc: string): string {
  let h = 0;
  const s = `${plan.patient.name}|${plan.patient.dischargeDate}|${doc.length}|${doc.slice(0, 200)}`;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function Dashboard(props: {
  plan: Plan;
  doc: string;
  paperSources: PaperSource[];
  mode: AIMode;
  originLabel: string;
  lang: string;
  setLang: (code: string) => void;
  langAvailable: (code: string) => boolean;
  translating: boolean;
  onReset: () => void;
}) {
  const { plan } = props;
  const { t, locale } = useUI();
  const trace = useTrace();
  const now = useNow();
  const discharge = useMemo(() => fromISODate(plan.patient.dischargeDate) ?? now, [plan, now]);
  const N = Math.max(plan.recoveryDays, 1);
  const today = Math.min(Math.max(daysBetween(discharge, now), 0), N);
  const [selectedDay, setSelectedDay] = useState(today);
  const isToday = selectedDay === today;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const key = planKey(plan, props.doc);
  const [allProgress, setAllProgress] = usePersistentState<Record<number, Progress>>(`liftoff:v1:${key}`, {});
  const progress = allProgress[selectedDay] ?? {};
  const setProgress = (itemKey: string, value: number) =>
    setAllProgress((p) => ({ ...p, [selectedDay]: { ...(p[selectedDay] ?? {}), [itemKey]: value } }));

  const items = useMemo(() => checklistFor(plan, selectedDay), [plan, selectedDay]);
  const todayItems = useMemo(() => checklistFor(plan, today), [plan, today]);
  const todayProgress = allProgress[today] ?? {};
  const dayDone =
    todayItems.length > 0 && todayItems.every((i) => (todayProgress[i.key] ?? 0) >= i.count);

  const [toast, setToast] = useState<string | null>(null);
  const wasDone = useRef(dayDone);
  useEffect(() => {
    if (dayDone && !wasDone.current) {
      setToast(t("dayComplete", { d: today, n: N - today }));
      const id = setTimeout(() => setToast(null), 4200);
      wasDone.current = dayDone;
      return () => clearTimeout(id);
    }
    wasDone.current = dayDone;
  }, [dayDone, today, N, t]);

  // Read today's remaining tasks aloud in the current language.
  const [speaking, setSpeaking] = useState(false);
  const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;
  const speak = () => {
    if (!canSpeak) return;
    if (speaking) {
      speechSynthesis.cancel();
      return setSpeaking(false);
    }
    const left = todayItems.filter((i) => (todayProgress[i.key] ?? 0) < i.count);
    const lines = [
      t("speakIntro", { d: today }),
      ...(left.length
        ? left.map((i) => (i.time ? `${formatClock(i.time, locale)}: ${i.title}.` : `${i.title}.`))
        : [t("speakDone")]),
    ];
    const u = new SpeechSynthesisUtterance(lines.join(" "));
    u.lang = locale;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
    setSpeaking(true);
  };
  useEffect(() => () => void (canSpeak && speechSynthesis.cancel()), [canSpeak]);

  const tones = useMemo(() => new Map(props.paperSources.map((s) => [s.id, s.tone])), [props.paperSources]);
  const verified = props.paperSources.filter((s) => s.span).length;

  return (
    <div className={`dash ${trace.papersOpen ? "with-papers" : ""}`}>
      <header className="topbar">
        <div className="brand">
          <RocketGlyph size={26} />
          <span>LIFTOFF</span>
        </div>
        <p className="patient">
          <strong>{plan.patient.name ?? "You"}</strong>
          {plan.patient.procedure && <span> · {plan.patient.procedure}</span>}
        </p>
        <div className="controls">
          <label className="lang" title={t("language")}>
            <GlobeIcon size={16} />
            <select
              id="language-select"
              value={props.lang}
              onChange={(e) => props.setLang(e.target.value)}
              aria-label={t("language")}
              disabled={props.translating}
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code} disabled={!props.langAvailable(l.code)}>
                  {l.label}
                  {!props.langAvailable(l.code) ? ` (${t("needsAI")})` : ""}
                </option>
              ))}
            </select>
          </label>
          {canSpeak && (
            <button type="button" className="btn btn-ghost" onClick={speak} id="read-aloud">
              {speaking ? <StopIcon size={16} /> : <SpeakerIcon size={16} />}
              <span>{speaking ? t("stopReading") : t("readAloud")}</span>
            </button>
          )}
          <button
            type="button"
            id="papers-button"
            className={`btn ${trace.papersOpen ? "btn-dark" : "btn-ghost"}`}
            onClick={() => (trace.papersOpen ? trace.closePapers() : trace.openPapers())}
          >
            <DocIcon size={16} />
            <span>{t("yourPapers")}</span>
            <span className="badge">
              {verified}/{props.paperSources.length}
            </span>
          </button>
          <button type="button" className="btn btn-link" onClick={props.onReset}>
            {t("newPapers")}
          </button>
        </div>
      </header>

      {props.translating && <div className="translating">{t("translating")}</div>}

      <main className="dash-main">
        <section className="mission" aria-label={t("recoveryPath")}>
          <div className="mission-day">
            <span className="label">{isToday ? t("today") : t("dayLabel", { d: selectedDay })}</span>
            <p className="day-big">
              <span className="day-word">{t("dayLabel", { d: "" }).trim()}</span>
              <b>{selectedDay}</b>
              <span className="day-of">/ {N}</span>
            </p>
            <p className="day-date">{formatShortDate(addDays(discharge, selectedDay), locale)}</p>
            <p className="summary">{plan.summary}</p>
            <p className="origin">{props.originLabel}</p>
          </div>
          <FlightProfile
            plan={plan}
            today={today}
            selectedDay={selectedDay}
            discharge={discharge}
            dayDone={dayDone}
            onSelectDay={setSelectedDay}
          />
        </section>

        {!isToday && (
          <div className="preview-bar" role="status">
            <span>
              {t("previewing", { d: selectedDay })} · {formatShortDate(addDays(discharge, selectedDay), locale)}
            </span>
            <button type="button" className="btn btn-small btn-dark" onClick={() => setSelectedDay(today)}>
              {t("backToToday")}
            </button>
          </div>
        )}

        <div className="instruments">
          <Checklist
            plan={plan}
            day={selectedDay}
            isToday={isToday}
            items={items}
            progress={progress}
            onProgress={setProgress}
          />
          <Medicines plan={plan} day={selectedDay} isToday={isToday} nowMinutes={nowMinutes} progress={progress} />
          <HelpPanel plan={plan} doc={props.doc} mode={props.mode} />
          <NotYet plan={plan} day={selectedDay} discharge={discharge} />
          <Questions plan={plan} />
        </div>

        <footer className="dash-foot fine">{t("footer")}</footer>
      </main>

      <PapersPanel text={props.doc} sources={props.paperSources} />
      <TraceLayer tones={tones} />
      {toast && (
        <div className="toast" role="status">
          <RocketGlyph size={20} /> {toast}
        </div>
      )}
    </div>
  );
}
