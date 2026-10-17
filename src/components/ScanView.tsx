import { useEffect, useMemo, useRef, useState } from "react";
import { useUI, usePrefersReducedMotion } from "../lib/context";
import { AlertIcon, ArrowIcon, CheckIcon, RocketGlyph } from "./Icons";
import { Paper, type PaperSource } from "./Paper";

export function ScanView(props: {
  text: string;
  photoUrl: string | null;
  /** Null while Claude is still reading. In document order once ready. */
  sources: PaperSource[] | null;
  originLabel: string | null;
  onLaunch: () => void;
}) {
  const { t } = useUI();
  const reduced = usePrefersReducedMotion();
  const [elapsed, setElapsed] = useState(0);
  const [revealed, setRevealed] = useState(0);
  const paperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const sources = props.sources;
  const total = sources?.length ?? 0;
  const done = sources != null && revealed >= total;

  useEffect(() => {
    if (sources) return;
    const start = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 250);
    return () => clearInterval(id);
  }, [sources]);

  // Reveal highlights one by one, in the order they appear on the page.
  useEffect(() => {
    if (!sources) return;
    if (reduced) return setRevealed(sources.length);
    setRevealed(0);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setRevealed(i);
      if (i >= sources.length) clearInterval(id);
    }, 130);
    return () => clearInterval(id);
  }, [sources, reduced]);

  const visible = useMemo(
    () => new Set((sources ?? []).slice(0, revealed).map((s) => s.id)),
    [sources, revealed],
  );
  const latest = sources?.[revealed - 1];

  // Keep the newest highlight in view on the paper and in the list.
  useEffect(() => {
    if (!latest) return;
    const mark = paperRef.current?.querySelector<HTMLElement>(`mark[data-ids~="${latest.id}"]`);
    const paper = paperRef.current;
    if (mark && paper) {
      const top = mark.offsetTop - paper.clientHeight * 0.4;
      paper.scrollTo({ top: Math.max(top, 0), behavior: reduced ? "auto" : "smooth" });
    }
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [latest, reduced]);

  const shown = (sources ?? []).slice(0, revealed);
  const verified = shown.filter((s) => s.span).length;
  const missing = shown.length - verified;

  return (
    <main className="scan">
      <section className={`scan-paper ${sources ? "" : "is-reading"}`}>
        {props.photoUrl && !props.text ? (
          <div className="paper photo-paper">
            <img src={props.photoUrl} alt="Your discharge papers" />
          </div>
        ) : (
          <Paper
            ref={paperRef}
            text={props.text}
            sources={sources ?? []}
            visible={visible}
            activeId={latest?.id ?? null}
            className="paper-scan"
          />
        )}
        {!sources && <div className="beam" aria-hidden />}
      </section>

      <aside className="scan-side" aria-live="polite">
        <header className="scan-head">
          <span className={`scan-rocket ${done ? "is-ready" : ""}`}>
            <RocketGlyph size={34} />
          </span>
          <div>
            <h2>{done ? t("scanDone") : t("scanning")}</h2>
            <p className="muted">
              {sources ? props.originLabel : `${elapsed}s`}
            </p>
          </div>
        </header>

        <div className="scan-stats">
          <div className="stat">
            <b>{shown.length}</b>
            <span>{t("statFound")}</span>
          </div>
          <div className="stat stat-ok">
            <b>{verified}</b>
            <span>{t("statMatched")}</span>
          </div>
          <div className={`stat ${missing ? "stat-warn" : ""}`}>
            <b>{missing}</b>
            <span>{t("statMissing")}</span>
          </div>
        </div>

        <ol className="scan-list" ref={listRef}>
          {!sources &&
            [0, 1, 2, 3, 4].map((i) => <li key={i} className="scan-skeleton" aria-hidden />)}
          {shown.map((s) => (
            <li key={s.id} className="scan-item">
              <span className={`dot tone-${s.tone}`} />
              <span className="scan-label">{s.label}</span>
              <span className="scan-kind">{t(`kind_${s.kind}`)}</span>
              {s.span ? (
                <CheckIcon size={16} className="ok" aria-label={t("verified")} />
              ) : (
                <AlertIcon size={16} className="warn" aria-label={t("notFound")} />
              )}
            </li>
          ))}
        </ol>

        <button id="launch-button" className="btn btn-primary btn-big" disabled={!done} onClick={props.onLaunch}>
          {t("launch")} <ArrowIcon size={20} />
        </button>
      </aside>
    </main>
  );
}
