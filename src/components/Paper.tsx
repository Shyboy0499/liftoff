import { forwardRef, useMemo } from "react";
import type { Tone } from "../lib/tones";
import type { SourceRef } from "../lib/verify";

export interface PaperSource extends SourceRef {
  tone: Tone;
}

interface Segment {
  text: string;
  ids: string[];
  tone: Tone | null;
  first: string[];
}

// Split the document at every highlight boundary so overlapping quotes (a
// milestone and a restriction citing the same sentence) render as one mark
// that belongs to both.
function segment(text: string, sources: PaperSource[]): Segment[] {
  const spans = sources.filter((s) => s.span);
  const cuts = new Set([0, text.length]);
  for (const s of spans) {
    cuts.add(s.span!.start);
    cuts.add(s.span!.end);
  }
  const points = [...cuts].sort((a, b) => a - b);
  const seen = new Set<string>();
  const out: Segment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const covering = spans.filter((s) => s.span!.start <= a && s.span!.end >= b);
    const first = covering.filter((s) => !seen.has(s.id)).map((s) => s.id);
    first.forEach((id) => seen.add(id));
    out.push({
      text: text.slice(a, b),
      ids: covering.map((s) => s.id),
      tone: covering[0]?.tone ?? null,
      first,
    });
  }
  return out;
}

interface PaperProps {
  text: string;
  sources: PaperSource[];
  /** Only these ids are highlighted (for the scan reveal). Default: all. */
  visible?: Set<string>;
  activeId?: string | null;
  className?: string;
  children?: React.ReactNode;
}

export const Paper = forwardRef<HTMLDivElement, PaperProps>(function Paper(
  { text, sources, visible, activeId, className, children },
  ref,
) {
  const segments = useMemo(() => segment(text, sources), [text, sources]);
  return (
    <div className={`paper ${className ?? ""}`} ref={ref}>
      <pre className="paper-text">
        {segments.map((s, i) => {
          const ids = visible ? s.ids.filter((id) => visible.has(id)) : s.ids;
          if (!ids.length || !s.tone) return <span key={i}>{s.text}</span>;
          const tone = sources.find((x) => x.id === ids[0])?.tone ?? s.tone;
          const active = activeId != null && ids.includes(activeId);
          return (
            <mark
              key={i}
              className={`hl tone-${tone}${active ? " is-active" : ""}`}
              data-ids={ids.join(" ")}
              data-first={s.first.filter((id) => ids.includes(id)).join(" ") || undefined}
            >
              {s.text}
            </mark>
          );
        })}
      </pre>
      {children}
    </div>
  );
});
