import { useLayoutEffect, useRef, useState } from "react";
import type { CheckInLog } from "../lib/checkin";
import { fToC } from "../lib/checkin";
import { useUI } from "../lib/context";
import { addDays, formatShortDate } from "../lib/dates";

// Two small charts, one per measure (never a shared y-axis): pain as bars on
// a fixed 0–10 scale, temperature as a line with the papers' limit drawn in.

const H = 150;
const PAD = { l: 30, r: 10, t: 14, b: 26 };

export type TempUnit = "F" | "C";

export function chartWindow(today: number): { start: number; end: number } {
  const start = Math.max(0, today - 13);
  return { start, end: Math.max(today, start + 7) };
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(320);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(Math.round(el.clientWidth), 200));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

interface ChartProps {
  log: CheckInLog;
  today: number;
  selectedDay: number;
  discharge: Date;
}

function useSlots(props: ChartProps, W: number) {
  const { start, end } = chartWindow(props.today);
  const n = end - start + 1;
  const slotW = (W - PAD.l - PAD.r) / n;
  const x = (d: number) => PAD.l + (d - start + 0.5) * slotW;
  const days = Array.from({ length: n }, (_, i) => start + i);
  return { start, end, slotW, x, days };
}

function Tooltip(props: { x: number; W: number; lines: string[] }) {
  const left = Math.min(Math.max(props.x, 70), props.W - 70);
  return (
    <div className="chart-tip" style={{ left }} role="status">
      {props.lines.map((l, i) => (i === 0 ? <b key={i}>{l}</b> : <span key={i}>{l}</span>))}
    </div>
  );
}

function DayAxis(props: { days: number[]; x: (d: number) => number; today: number; selectedDay: number; slotW: number }) {
  const every = props.slotW < 26 ? 2 : 1;
  return (
    <g className="log-axis">
      <line x1={PAD.l} x2={props.x(props.days.at(-1)!) + props.slotW / 2} y1={H - PAD.b} y2={H - PAD.b} className="log-base" />
      {props.days.map((d, i) =>
        i % every === 0 || d === props.today ? (
          <text
            key={d}
            x={props.x(d)}
            y={H - PAD.b + 16}
            textAnchor="middle"
            className={`log-day ${d === props.selectedDay ? "is-selected" : ""} ${d > props.today ? "is-future" : ""}`}
          >
            D{d}
          </text>
        ) : null,
      )}
    </g>
  );
}

export function PainChart(props: ChartProps) {
  const { t, locale } = useUI();
  const [ref, W] = useWidth<HTMLDivElement>();
  const { days, x, slotW } = useSlots(props, W);
  const [hover, setHover] = useState<number | null>(null);
  const y = (v: number) => H - PAD.b - (v / 10) * (H - PAD.t - PAD.b);
  const barW = Math.min(22, slotW * 0.56);

  // Bar with a 4 px rounded top, square on the baseline.
  const bar = (cx: number, v: number) => {
    const top = y(v);
    const base = H - PAD.b;
    const r = Math.min(4, (base - top) / 2, barW / 2);
    const l = cx - barW / 2;
    const rr = cx + barW / 2;
    return `M${l},${base}V${top + r}Q${l},${top} ${l + r},${top}H${rr - r}Q${rr},${top} ${rr},${top + r}V${base}Z`;
  };

  const hovered = hover != null ? props.log[hover] : null;

  return (
    <div className="log-chart" ref={ref} onMouseLeave={() => setHover(null)}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t("painChart")}>
        {[0, 5, 10].map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className="log-grid" />
            <text x={PAD.l - 8} y={y(v) + 4} textAnchor="end" className="log-tick">
              {v}
            </text>
          </g>
        ))}
        {days.map((d) => {
          const v = props.log[d]?.pain;
          if (v == null) {
            return d <= props.today ? (
              <line key={d} x1={x(d) - 4} x2={x(d) + 4} y1={H - PAD.b - 3} y2={H - PAD.b - 3} className="log-missing" />
            ) : null;
          }
          return (
            <g key={d}>
              {v > 0 ? (
                <path d={bar(x(d), v)} className={`log-bar ${hover === d ? "is-hover" : ""}`} />
              ) : (
                <line x1={x(d) - barW / 2} x2={x(d) + barW / 2} y1={H - PAD.b - 1} y2={H - PAD.b - 1} className="log-zero" />
              )}
              {d === props.selectedDay && (
                <text x={x(d)} y={y(v) - 6} textAnchor="middle" className="log-value">
                  {v}
                </text>
              )}
            </g>
          );
        })}
        <DayAxis days={days} x={x} today={props.today} selectedDay={props.selectedDay} slotW={slotW} />
        {days.map((d) => (
          <rect key={d} x={x(d) - slotW / 2} y={PAD.t} width={slotW} height={H - PAD.t - PAD.b} className="log-hit" onMouseEnter={() => setHover(d)} />
        ))}
      </svg>
      {hover != null && hover <= props.today && (
        <Tooltip
          x={x(hover)}
          W={W}
          lines={[
            `${t("dayLabel", { d: hover })} · ${formatShortDate(addDays(props.discharge, hover), locale)}`,
            hovered?.pain != null ? `${t("colPain")}: ${hovered.pain}/10` : t("noCheckins"),
          ]}
        />
      )}
    </div>
  );
}

export function TempChart(props: ChartProps & { maxF: number | null; unit: TempUnit }) {
  const { t, locale } = useUI();
  const [ref, W] = useWidth<HTMLDivElement>();
  const { days, x, slotW } = useSlots(props, W);
  const [hover, setHover] = useState<number | null>(null);
  const conv = (f: number) => (props.unit === "F" ? f : fToC(f));
  const fmt = (f: number) => `${+conv(f).toFixed(1)}°${props.unit}`;

  const values = days.map((d) => props.log[d]?.tempF).filter((v): v is number => v != null);
  const loF = Math.min(97, ...values.map((v) => v - 0.6));
  const hiF = Math.max((props.maxF ?? 100.4) + 1, ...values.map((v) => v + 0.6));
  const y = (f: number) => H - PAD.b - ((f - loF) / (hiF - loF)) * (H - PAD.t - PAD.b);

  // Break the line where a day has no reading.
  const segments: string[] = [];
  let current: string[] = [];
  for (const d of days) {
    const v = props.log[d]?.tempF;
    if (v == null) {
      if (current.length) segments.push(current.join("L"));
      current = [];
    } else current.push(`${x(d).toFixed(1)},${y(v).toFixed(1)}`);
  }
  if (current.length) segments.push(current.join("L"));

  // Whole-degree ticks in the display unit, 1 or 2 apart.
  const lo = conv(loF);
  const hi = conv(hiF);
  const step = hi - lo > 5 ? 2 : 1;
  const ticks: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);
  const hovered = hover != null ? props.log[hover] : null;

  return (
    <div className="log-chart" ref={ref} onMouseLeave={() => setHover(null)}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t("tempChart")}>
        {ticks.map((v) => {
          const f = props.unit === "F" ? v : (v * 9) / 5 + 32;
          return (
            <g key={v}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(f)} y2={y(f)} className="log-grid" />
              <text x={PAD.l - 8} y={y(f) + 4} textAnchor="end" className="log-tick">
                {v}
              </text>
            </g>
          );
        })}
        {props.maxF != null && (
          <g className="log-limit">
            <line x1={PAD.l} x2={W - PAD.r} y1={y(props.maxF)} y2={y(props.maxF)} />
            <text x={W - PAD.r} y={y(props.maxF) - 6} textAnchor="end">
              ⚠ {t("callAbove", { v: fmt(props.maxF) })}
            </text>
          </g>
        )}
        {hover != null && hover <= props.today && (
          <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} className="log-crosshair" />
        )}
        {segments.map((s, i) => (
          <path key={i} d={`M${s}`} className="log-line" />
        ))}
        {days.map((d) => {
          const v = props.log[d]?.tempF;
          if (v == null) return null;
          const over = props.maxF != null && v > props.maxF;
          return (
            <g key={d}>
              <circle cx={x(d)} cy={y(v)} r={4.5} className={`log-point ${over ? "is-over" : ""}`} />
              {(d === props.selectedDay || over) && (
                <text x={x(d)} y={y(v) - 9} textAnchor="middle" className={`log-value ${over ? "is-over" : ""}`}>
                  {conv(v).toFixed(1)}
                </text>
              )}
            </g>
          );
        })}
        <DayAxis days={days} x={x} today={props.today} selectedDay={props.selectedDay} slotW={slotW} />
        {days.map((d) => (
          <rect key={d} x={x(d) - slotW / 2} y={PAD.t} width={slotW} height={H - PAD.t - PAD.b} className="log-hit" onMouseEnter={() => setHover(d)} />
        ))}
      </svg>
      {hover != null && hover <= props.today && (
        <Tooltip
          x={x(hover)}
          W={W}
          lines={[
            `${t("dayLabel", { d: hover })} · ${formatShortDate(addDays(props.discharge, hover), locale)}`,
            hovered?.tempF != null ? `${t("colTemp")}: ${fmt(hovered.tempF)}` : t("noCheckins"),
          ]}
        />
      )}
    </div>
  );
}
