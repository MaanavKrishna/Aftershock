import type { ReactNode } from "react";
import { Check, Clock, Cross, Dashed, Half, Pencil, Ring, Spinner, Wave } from "./icons";

/**
 * Status is never colour alone: every verdict has its own icon, its own word and a tint.
 * Colours: proven/safe/recur/inconclusive/flaky are reserved for verdicts; signal blue is for interaction only.
 */
export type VerdictKind =
  | "proven"
  | "safe"
  | "recur"
  | "failing"
  | "inconclusive"
  | "skipped"
  | "drafted"
  | "flaky"
  | "running"
  | "awaiting"
  | "unproven"
  | "rejected"
  | "healthy"
  | "weak"
  | "drifted";

type Spec = { Icon: (p: { size?: number }) => ReactNode; label: string; cls: string };
const neutral = "text-fg-2 bg-s2";
export const VERDICTS: Record<VerdictKind, Spec> = {
  proven: { Icon: Check, label: "Proven", cls: "text-proven bg-proven-soft" },
  healthy: { Icon: Check, label: "Healthy", cls: "text-proven bg-proven-soft" },
  safe: { Icon: Check, label: "Safe", cls: "text-safe bg-safe-soft" },
  recur: { Icon: Cross, label: "Recur", cls: "text-recur bg-recur-soft" },
  failing: { Icon: Cross, label: "Failing", cls: "text-recur bg-recur-soft" },
  inconclusive: { Icon: Half, label: "Inconclusive", cls: "text-inconclusive bg-inconclusive-soft" },
  weak: { Icon: Half, label: "Weak", cls: "text-inconclusive bg-inconclusive-soft" },
  awaiting: { Icon: Clock, label: "Awaiting fix", cls: "text-inconclusive bg-inconclusive-soft" },
  flaky: { Icon: Wave, label: "Flaky", cls: "text-flaky bg-flaky-soft" },
  drifted: { Icon: Wave, label: "Drifted", cls: "text-flaky bg-flaky-soft" },
  drafted: { Icon: Pencil, label: "AI draft", cls: "text-flaky bg-flaky-soft" },
  running: { Icon: Spinner, label: "Running", cls: neutral },
  skipped: { Icon: Ring, label: "Skipped", cls: neutral },
  unproven: { Icon: Dashed, label: "Unproven", cls: neutral },
  rejected: { Icon: Ring, label: "Rejected", cls: neutral },
};

/** The verdict pill: icon + word + tint, 24px tall. A border appears in forced-colours mode. */
export function Verdict({ kind, label, size = "md", testId }: { kind: VerdictKind; label?: string; size?: "sm" | "md"; testId?: string }) {
  const v = VERDICTS[kind];
  return (
    <span
      data-testid={testId}
      data-verdict={kind}
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-chip font-medium forced-colors:border forced-colors:border-[CanvasText] ${size === "sm" ? "min-h-5 px-1.5 text-caption" : "min-h-6 px-2 text-callout"} ${v.cls}`}
    >
      <v.Icon size={size === "sm" ? 12 : 14} />
      {label ?? v.label}
    </span>
  );
}
