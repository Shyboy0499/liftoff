import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { EN, format, type UIKey, type UIStrings } from "./i18n";
import type { SourceRef } from "./verify";

// ---- Interface language -------------------------------------------------

interface UIContextValue {
  t: (key: UIKey, vars?: Record<string, string | number>) => string;
  locale: string;
}

const UIContext = createContext<UIContextValue>({
  t: (k, v) => format(EN[k], v),
  locale: "en",
});

export function UIProvider(props: { strings: UIStrings; locale: string; children: ReactNode }) {
  const value = useMemo<UIContextValue>(
    () => ({ t: (k, v) => format(props.strings[k] ?? EN[k], v), locale: props.locale }),
    [props.strings, props.locale],
  );
  return <UIContext.Provider value={value}>{props.children}</UIContext.Provider>;
}

export const useUI = () => useContext(UIContext);

// ---- Source tracing -----------------------------------------------------
// Which plan item is being traced back to the papers, and the element the
// trace line should start from.

export interface TraceTarget {
  id: string;
  el: HTMLElement | SVGElement | null;
}

interface TraceContextValue {
  sources: Map<string, SourceRef>;
  papersOpen: boolean;
  openPapers: (target?: TraceTarget) => void;
  closePapers: () => void;
  active: TraceTarget | null;
  setHover: (target: TraceTarget | null) => void;
}

const TraceContext = createContext<TraceContextValue | null>(null);

export function TraceProvider(props: { sources: Map<string, SourceRef>; children: ReactNode }) {
  const [papersOpen, setPapersOpen] = useState(false);
  const [pinned, setPinned] = useState<TraceTarget | null>(null);
  const [hover, setHoverState] = useState<TraceTarget | null>(null);

  const openPapers = useCallback((target?: TraceTarget) => {
    setPapersOpen(true);
    if (target) setPinned(target);
  }, []);
  const closePapers = useCallback(() => {
    setPapersOpen(false);
    setPinned(null);
    setHoverState(null);
  }, []);
  const setHover = useCallback((target: TraceTarget | null) => setHoverState(target), []);

  const value = useMemo<TraceContextValue>(
    () => ({
      sources: props.sources,
      papersOpen,
      openPapers,
      closePapers,
      active: hover ?? pinned,
      setHover,
    }),
    [props.sources, papersOpen, openPapers, closePapers, hover, pinned, setHover],
  );
  return <TraceContext.Provider value={value}>{props.children}</TraceContext.Provider>;
}

export function useTrace(): TraceContextValue {
  const ctx = useContext(TraceContext);
  if (!ctx) throw new Error("useTrace outside TraceProvider");
  return ctx;
}

// ---- Small shared hooks ---------------------------------------------------

/** State mirrored to localStorage. Storage can be missing or throw. */
export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Private window or blocked storage: progress lasts for this visit only.
    }
  }, [key, value]);
  return [value, setValue] as const;
}

/** The current time, refreshed every 30 seconds. */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}
