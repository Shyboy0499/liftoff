import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTrace, useUI, usePrefersReducedMotion } from "../lib/context";
import { TONES } from "../lib/tones";
import { CheckIcon, CloseIcon } from "./Icons";
import { Paper, type PaperSource } from "./Paper";

export function PapersPanel(props: { text: string; sources: PaperSource[] }) {
  const { t } = useUI();
  const trace = useTrace();
  const reduced = usePrefersReducedMotion();
  const paperRef = useRef<HTMLDivElement>(null);
  const activeId = trace.active?.id ?? null;
  const verified = props.sources.filter((s) => s.span).length;

  // Bring the cited line into view whenever a different item is traced.
  useEffect(() => {
    if (!activeId || !trace.papersOpen) return;
    const timer = setTimeout(() => {
      const mark = paperRef.current?.querySelector<HTMLElement>(`mark[data-ids~="${activeId}"]`);
      mark?.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
    }, 120);
    return () => clearTimeout(timer);
  }, [activeId, trace.papersOpen, reduced]);

  return (
    <aside className={`papers-panel ${trace.papersOpen ? "is-open" : ""}`} aria-hidden={!trace.papersOpen} aria-label={t("yourPapers")}>
      <header className="papers-head">
        <div>
          <h2 className="label">{t("yourPapers")}</h2>
          <p className="papers-count">
            <CheckIcon size={15} /> {t("papersCount", { v: verified, n: props.sources.length })}
          </p>
        </div>
        <button type="button" className="icon-btn" onClick={trace.closePapers} aria-label="Close">
          <CloseIcon size={18} />
        </button>
      </header>
      <Paper ref={paperRef} text={props.text} sources={props.sources} activeId={activeId} className="paper-panel" />
      <ul className="legend">
        {TONES.map((tone) => (
          <li key={tone}>
            <span className={`dot tone-${tone}`} />
            {t(`tone_${tone}`)}
          </li>
        ))}
      </ul>
    </aside>
  );
}

/** The line from a plan item to the words it came from on the papers. */
export function TraceLayer(props: { tones: Map<string, string> }) {
  const trace = useTrace();
  const [geo, setGeo] = useState<{ d: string; x1: number; y1: number; x2: number; y2: number } | null>(null);
  const active = trace.papersOpen ? trace.active : null;

  useLayoutEffect(() => {
    if (!active?.el) return setGeo(null);
    let raf = 0;
    const frame = () => {
      const el = active.el;
      const panel = document.querySelector(".paper-panel");
      const mark = panel?.querySelector<HTMLElement>(`mark[data-ids~="${active.id}"]`);
      const a = el?.getBoundingClientRect();
      const offscreen = !a || a.bottom < 60 || a.top > window.innerHeight;
      if (!el || !a || !el.isConnected || offscreen || !mark || !panel || window.innerWidth < 900) {
        setGeo((prev) => (prev ? null : prev));
      } else {
        const b = mark.getBoundingClientRect();
        const box = panel.getBoundingClientRect();
        const x1 = a.right + 2;
        const y1 = a.top + a.height / 2;
        const x2 = Math.max(b.left - 3, box.left + 4);
        const y2 = Math.min(Math.max(b.top + Math.min(b.height, 22) / 2, box.top + 8), box.bottom - 8);
        const dx = Math.max((x2 - x1) * 0.5, 60);
        const d = `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
        setGeo((prev) => (prev?.d === d ? prev : { d, x1, y1, x2, y2 }));
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  if (!geo || !active) return null;
  const tone = props.tones.get(active.id) ?? "limit";
  return (
    <svg className={`trace-layer tone-${tone}`} aria-hidden>
      <path key={active.id} d={geo.d} className="trace-path" pathLength={1} />
      <circle cx={geo.x1} cy={geo.y1} r={4} className="trace-end" />
      <circle cx={geo.x2} cy={geo.y2} r={5} className="trace-end" />
    </svg>
  );
}
