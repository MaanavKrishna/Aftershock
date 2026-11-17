import type { ReactNode } from "react";
import type { CheckVerdict, IncidentStatus } from "@/lib/db/schema";
import { Verdict, type VerdictKind } from "./Verdict";

/** A neutral label chip (counts, tags, metadata). For statuses use `Verdict`, `StatusPill` or `VerdictPill`. */
export type Tone = "pass" | "fail" | "solidFail" | "neutral" | "dashed" | "ink" | "warn" | "passDark" | "signal";

const TONES: Record<Tone, string> = {
  pass: "bg-proven-soft text-proven",
  passDark: "bg-proven-soft text-proven",
  fail: "bg-recur-soft text-recur",
  warn: "bg-inconclusive-soft text-inconclusive",
  solidFail: "bg-recur text-on-signal",
  neutral: "bg-s2 text-fg-2",
  dashed: "border border-dashed border-border-strong text-fg-2",
  ink: "bg-fg text-canvas",
  signal: "bg-signal-soft text-signal",
};

export function Pill({ tone, children, mono = false, testId }: { tone: Tone; children: ReactNode; mono?: boolean; testId?: string }) {
  return (
    <span data-testid={testId} className={`inline-flex min-h-6 shrink-0 items-center whitespace-nowrap rounded-chip px-2 text-caption font-medium ${mono ? "font-mono" : ""} ${TONES[tone]}`}>
      {children}
    </span>
  );
}

export const STATUS_KIND: Record<IncidentStatus, VerdictKind> = {
  proven: "proven",
  traveling: "running",
  unproven: "unproven",
  awaiting_fix: "awaiting",
  rejected: "rejected",
};
const STATUS_TEXT: Partial<Record<IncidentStatus, string>> = { traveling: "Time traveling" };

export function StatusPill({ status }: { status: IncidentStatus }) {
  return <Verdict kind={STATUS_KIND[status]} label={STATUS_TEXT[status]} testId="incident-status" />;
}

export const VERDICT_KIND: Record<CheckVerdict | "running", VerdictKind> = {
  recur: "recur",
  safe: "safe",
  inconclusive: "inconclusive",
  skipped: "skipped",
  running: "running",
};

export function VerdictPill({ verdict }: { verdict: CheckVerdict | null }) {
  return <Verdict kind={VERDICT_KIND[verdict ?? "running"]} />;
}
