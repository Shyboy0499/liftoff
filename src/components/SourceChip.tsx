import { useTrace, useUI } from "../lib/context";
import { AlertIcon, CheckIcon } from "./Icons";

/** Opens the papers at the line this item came from. */
export function SourceChip({ id, compact = false }: { id: string; compact?: boolean }) {
  const { t } = useUI();
  const trace = useTrace();
  const src = trace.sources.get(id);
  const ok = Boolean(src?.span);
  const active = trace.active?.id === id;
  return (
    <button
      type="button"
      className={`source-chip ${ok ? "is-ok" : "is-missing"}${active ? " is-active" : ""}${compact ? " is-compact" : ""}`}
      title={ok ? t("verified") : t("notFound")}
      data-source={id}
      onClick={(e) => trace.openPapers({ id, el: e.currentTarget })}
      onMouseEnter={(e) => trace.papersOpen && trace.setHover({ id, el: e.currentTarget })}
      onMouseLeave={() => trace.papersOpen && trace.setHover(null)}
      onFocus={(e) => trace.papersOpen && trace.setHover({ id, el: e.currentTarget })}
      onBlur={() => trace.papersOpen && trace.setHover(null)}
    >
      {ok ? <CheckIcon size={13} /> : <AlertIcon size={13} />}
      {!compact && <span>{t("source")}</span>}
    </button>
  );
}
