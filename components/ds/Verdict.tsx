/** Status is never colour alone: each verdict has its own shape and word. */
export type VerdictKind = "proven" | "safe" | "recur" | "failing" | "inconclusive" | "skipped" | "drafted";
const V: Record<VerdictKind, { mark: string; label: string; cls: string }> = {
  proven: { mark: "✓", label: "Proven", cls: "text-signal bg-signal-soft" },
  safe: { mark: "✓", label: "Safe", cls: "text-signal bg-signal-soft" },
  recur: { mark: "✕", label: "Recur", cls: "text-quake bg-quake-soft" },
  failing: { mark: "✕", label: "Failing", cls: "text-quake bg-quake-soft" },
  inconclusive: { mark: "◐", label: "Inconclusive", cls: "text-amber bg-raised-2" },
  skipped: { mark: "○", label: "Skipped", cls: "text-fg-3 bg-raised-2" },
  drafted: { mark: "✎", label: "AI draft", cls: "text-violet bg-raised-2" },
};

export function Verdict({ kind, label }: { kind: VerdictKind; label?: string }) {
  const v = V[kind];
  return (
    <span className={`inline-flex min-h-7 items-center gap-1.5 rounded-chip px-2.5 text-[13px] font-semibold ${v.cls}`}>
      <span aria-hidden="true">{v.mark}</span>
      {label ?? v.label}
    </span>
  );
}
