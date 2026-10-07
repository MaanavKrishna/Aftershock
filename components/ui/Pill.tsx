import type { ReactNode } from "react";
import type { CheckVerdict, IncidentStatus } from "@/lib/db/schema";

export type Tone = "pass" | "fail" | "solidFail" | "neutral" | "dashed" | "ink" | "warn" | "passDark";

const TONES: Record<Tone, string> = {
  pass: "bg-pass-tint text-pass-deep",
  fail: "bg-fail-tint text-fail-ink",
  solidFail: "bg-fail text-white",
  neutral: "bg-neutral-tint text-body",
  dashed: "border border-dashed border-muted-2 text-body",
  ink: "bg-ink text-white",
  warn: "bg-fail-tint text-fail-ink",
  passDark: "bg-pass-dark text-ink",
};

export function Pill({ tone, children, mono = false, testId }: { tone: Tone; children: ReactNode; mono?: boolean; testId?: string }) {
  return (
    <span data-testid={testId} className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-md px-[9px] py-[3px] text-[11.5px] font-semibold ${mono ? "font-mono" : ""} ${TONES[tone]}`}>
      {children}
    </span>
  );
}

export const STATUS_LABEL: Record<IncidentStatus, [string, Tone]> = {
  proven: ["Proven", "pass"],
  traveling: ["Time traveling", "ink"],
  unproven: ["Unproven", "dashed"],
  awaiting_fix: ["Awaiting fix", "warn"],
  rejected: ["Rejected", "neutral"],
};

export function StatusPill({ status }: { status: IncidentStatus }) {
  const [label, tone] = STATUS_LABEL[status];
  return <Pill tone={tone} testId="incident-status">{label}</Pill>;
}

export const VERDICT_LABEL: Record<CheckVerdict | "running", [string, Tone]> = {
  recur: ["Recur", "solidFail"],
  safe: ["Safe", "pass"],
  inconclusive: ["Inconclusive", "dashed"],
  skipped: ["Skipped", "neutral"],
  running: ["Running", "ink"],
};

export function VerdictPill({ verdict }: { verdict: CheckVerdict | null }) {
  const [label, tone] = VERDICT_LABEL[verdict ?? "running"];
  return <Pill tone={tone}>{label}</Pill>;
}
