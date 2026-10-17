import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Plan } from "../lib/schema";
import { useTrace, useUI, usePrefersReducedMotion } from "../lib/context";
import { addDays, formatShortDate } from "../lib/dates";

// The recovery "flight profile": days since discharge on x, an ascent curve
// on y, milestones from the papers pinned along it, and the rocket at today.
// The SVG is drawn at its real pixel width so text never scales down.

const PAD = { l: 40, r: 44, b: 46 };
const CLIMB = 150; // height of the ascent, px
const ROW = 30; // milestone label row height, px

const ease = (t: number) => 1 - Math.pow(1 - t, 3);

export function FlightProfile(props: {
  plan: Plan;
  today: number;
  selectedDay: number;
  discharge: Date;
  dayDone: boolean;
  onSelectDay: (day: number) => void;
}) {
  const { plan, today } = props;
  const { t, locale } = useUI();
  const trace = useTrace();
  const reduced = usePrefersReducedMotion();
  const N = Math.max(plan.recoveryDays, today, 1);
  const [hoverDay, setHoverDay] = useState<number | null>(null);

  const figRef = useRef<HTMLElement>(null);
  const [W, setW] = useState(900);
  useLayoutEffect(() => {
    const el = figRef.current;
    if (!el) return;
    const measure = () => setW(Math.max(Math.round(el.clientWidth), 300));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const x = (d: number) => PAD.l + (d / N) * (W - PAD.l - PAD.r);

  // Milestone labels go in rows above the curve; each label takes the first
  // row where it doesn't overlap its neighbour.
  const labels = useMemo(() => {
    const rowEnds: number[] = [];
    return [...plan.milestones]
      .sort((a, b) => a.day - b.day)
      .map((m) => {
        const width = m.title.length * 7 + 46;
        const cx = Math.min(Math.max(x(m.day), width / 2 + 2), W - width / 2 - 2);
        const left = cx - width / 2;
        let row = rowEnds.findIndex((end) => left > end + 8);
        if (row === -1) row = rowEnds.length;
        rowEnds[row] = left + width;
        return { m, width, cx, row };
      });
  }, [plan.milestones, N, W]); // x() depends only on N and W

  const rows = Math.max(1, ...labels.map((l) => l.row + 1));
  const top = 10 + rows * ROW + 16;
  const H = top + CLIMB + PAD.b;
  const base = H - PAD.b;
  const y = (d: number) => base - ease(Math.min(d / N, 1)) * CLIMB;

  // Launch animation: the flown path and the rocket travel from day 0 to today.
  const [flown, setFlown] = useState(reduced ? today : 0);
  useEffect(() => {
    if (reduced) return setFlown(today);
    let raf = 0;
    const start = performance.now();
    const dur = 1700;
    const step = (now: number) => {
      const p = Math.min((now - start) / dur, 1);
      setFlown(today * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [today, reduced]);

  const path = (from: number, to: number) => {
    const pts: string[] = [];
    const steps = Math.max(Math.ceil((to - from) * 6), 1);
    for (let i = 0; i <= steps; i++) {
      const d = from + ((to - from) * i) / steps;
      pts.push(`${x(d).toFixed(1)},${y(d).toFixed(1)}`);
    }
    return `M${pts.join("L")}`;
  };

  const flownPath = path(0, flown);
  const aheadPath = path(today, N);
  const areaPath = `${flownPath}L${x(flown).toFixed(1)},${base}L${x(0)},${base}Z`;

  // Rocket heading follows the curve's slope.
  const rx = x(flown);
  const ry = y(flown);
  const ahead = Math.min(flown + 0.4, N);
  const angle = (Math.atan2(y(ahead) - ry, x(ahead) - rx) * 180) / Math.PI + 90;

  const ticks = useMemo(() => {
    const step = W < 560 ? 14 : 7;
    const out: number[] = [];
    for (let d = 0; d < N; d += step) out.push(d);
    if (N - out[out.length - 1] >= step / 2) out.push(N);
    else out[out.length - 1] = N;
    return out;
  }, [N, W]);

  const shownDay = hoverDay ?? props.selectedDay;
  const colW = (W - PAD.l - PAD.r) / N;

  return (
    <figure className="profile" ref={figRef}>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        className="profile-svg"
        role="img"
        aria-label={`${t("recoveryPath")}: ${t("dayOf", { d: today, n: N })}`}
        onMouseLeave={() => setHoverDay(null)}
      >
        <defs>
          <linearGradient id="flown-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--accent)" stopOpacity=".38" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {ticks.map((d) => (
          <g key={d} className="axis-tick">
            <line x1={x(d)} x2={x(d)} y1={top - 6} y2={base} className="grid" />
            <text x={x(d)} y={base + 18} textAnchor={d === N ? "end" : d === 0 ? "start" : "middle"} className="tick-day">
              {d === N ? t("fullRecovery").toUpperCase() : t("dayLabel", { d }).toUpperCase()}
            </text>
            <text x={x(d)} y={base + 34} textAnchor={d === N ? "end" : d === 0 ? "start" : "middle"} className="tick-date">
              {formatShortDate(addDays(props.discharge, d), locale)}
            </text>
          </g>
        ))}
        <line x1={PAD.l} x2={W - PAD.r} y1={base} y2={base} className="axis" />

        <path d={areaPath} fill="url(#flown-fill)" />
        <path d={aheadPath} className="path-ahead" />
        <path d={flownPath} className="path-flown" />

        {shownDay !== today && (
          <g className="guide">
            <line x1={x(shownDay)} x2={x(shownDay)} y1={y(shownDay)} y2={base} />
            <circle cx={x(shownDay)} cy={y(shownDay)} r={5} />
          </g>
        )}

        {labels.map(({ m, width, cx, row }) => {
          const reached = m.day <= today;
          const ly = 10 + row * ROW;
          return (
            <g
              key={m.id}
              className={`milestone ${reached ? "is-reached" : ""}`}
              onMouseEnter={(e) => trace.papersOpen && trace.setHover({ id: m.id, el: e.currentTarget })}
              onMouseLeave={() => trace.papersOpen && trace.setHover(null)}
              onClick={(e) => trace.openPapers({ id: m.id, el: e.currentTarget })}
            >
              <line x1={x(m.day)} x2={x(m.day)} y1={ly + 22} y2={y(m.day) - 7} className="leader" />
              <rect x={cx - width / 2} y={ly} width={width} height={22} rx={11} className="ms-pill" />
              <text x={cx - width / 2 + 11} y={ly + 15} className="ms-day">
                D{m.day}
              </text>
              <text x={cx - width / 2 + 38} y={ly + 15} className="ms-title">
                {m.title}
              </text>
              <circle cx={x(m.day)} cy={y(m.day)} r={6} className="ms-dot" />
            </g>
          );
        })}

        {Array.from({ length: N + 1 }, (_, d) => (
          <rect
            key={d}
            x={x(d) - colW / 2}
            y={top - 6}
            width={colW}
            height={base - top + 6}
            className="day-hit"
            onMouseEnter={() => setHoverDay(d)}
            onClick={() => props.onSelectDay(d)}
          >
            <title>{`${t("dayLabel", { d })} · ${formatShortDate(addDays(props.discharge, d), locale)}`}</title>
          </rect>
        ))}

        <g className="today-tag" transform={`translate(${rx} ${ry - 40})`}>
          <rect x={-30} y={-11} width={60} height={22} rx={11} />
          <text y={4} textAnchor="middle">
            {t("today").toUpperCase()}
          </text>
        </g>

        <g transform={`translate(${rx} ${ry}) rotate(${angle})`} className={`rocket ${props.dayDone ? "is-boost" : ""}`}>
          <circle r={20} className="rocket-halo" />
          <g transform="translate(-13.8 -13.8) scale(1.15)">
            <path className="rocket-flame" d="M10 17.2h4l-.7 2.9L12 22.6l-1.3-2.5z" />
            <path d="M7.6 12.4 4.9 15.6v2.6l2.7-1.5z" className="rocket-fin" />
            <path d="M16.4 12.4l2.7 3.2v2.6l-2.7-1.5z" className="rocket-fin" />
            <path d="M12 1.6c3.1 2.6 4.6 6.2 4.6 10.8v4.8H7.4v-4.8c0-4.6 1.5-8.2 4.6-10.8z" className="rocket-body" />
            <circle cx="12" cy="9.4" r="1.9" className="rocket-window" />
          </g>
        </g>
      </svg>
    </figure>
  );
}
