import Link from "next/link";
import type { ReactNode } from "react";
import { LogoMark } from "@/components/ui/Logo";
import { VerdictPill } from "@/components/ui/Pill";
import { Verdict } from "@/components/ui/Verdict";
import { Pill } from "@/components/ui/Pill";
import { Strip, toCells } from "@/components/ui/Strip";
import type { CheckVerdict } from "@/lib/db/schema";
import type { RunResult } from "@/lib/domain/verdict";

export type GuardRow = { id: string; key: string; title: string; why: string; verdict: CheckVerdict; runs: RunResult[]; href: string; selected: boolean };

/**
 * The pull request check as GitHub shows it: the check name and verdict, the risk, every memory test that guarded
 * the change, and what to do next (a suggested fix, or an override with a reason).
 */
export function CheckCard({
  verdict,
  mode,
  overridden,
  summary,
  risk,
  rows,
  emptyText,
  next,
}: {
  verdict: CheckVerdict | null;
  mode: "blocking" | "advisory";
  overridden: boolean;
  summary: ReactNode;
  risk?: { level: string; reasons: string[] } | null;
  rows: GuardRow[];
  emptyText: string;
  next?: ReactNode;
}) {
  return (
    <section aria-labelledby="check-h" className="overflow-hidden rounded-card border border-border bg-s1 shadow-e1">
      <div className="flex flex-wrap items-center gap-3 border-b border-border-soft px-5 py-3.5">
        <LogoMark size={22} accent />
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 id="check-h" className="m-0 text-ui font-semibold text-fg">
            Aftershock / memory
          </h2>
          <span className="text-caption text-fg-3">{mode === "blocking" ? "Required check · a recurrence blocks the merge" : "Advisory check · reported, never blocks"}</span>
        </div>
        <span className="flex flex-wrap items-center gap-1.5">
          {overridden && <Pill tone="dashed">Overridden</Pill>}
          <VerdictPill verdict={verdict} />
        </span>
      </div>
      <div className="flex flex-col gap-3 px-5 py-4">
        <p className="m-0 text-ui text-fg-2">{summary}</p>
        {risk && risk.level !== "low" && (
          <div className={`flex flex-wrap items-start gap-2 rounded-control px-3 py-2.5 text-callout ${risk.level === "high" ? "bg-recur-soft" : "bg-s2"}`}>
            <Verdict kind={risk.level === "high" ? "recur" : "inconclusive"} label={`Risk: ${risk.level}`} size="sm" />
            <span className="min-w-0 flex-1 text-fg">{risk.reasons.join("; ")}.</span>
          </div>
        )}
      </div>
      <div className="border-t border-border-soft">
        <div className="flex items-center justify-between px-5 pb-1 pt-3">
          <span className="text-caption font-medium text-fg-3">Guarding tests</span>
          <span className="text-caption text-fg-3">Select one to see its trace</span>
        </div>
        <ul className="m-0 list-none p-0 pb-1">
          {rows.map((r) => (
            <li key={r.id} className="px-2">
              <Link
                href={r.href}
                aria-current={r.selected ? "true" : undefined}
                className={`flex items-center gap-3 rounded-control px-3 py-2.5 no-underline transition-colors duration-150 ease-fl ${r.selected ? "bg-s2" : "hover:bg-s2/60"}`}
              >
                <span className="w-14 shrink-0 font-mono text-callout text-fg-3">{r.key}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-ui font-medium text-fg">{r.title}</span>
                  <span className="truncate text-caption text-fg-3">{r.why}</span>
                </span>
                <span className="w-12 shrink-0 max-sm:hidden">
                  <Strip cells={toCells(r.runs, 3)} height={8} label={`Runs: ${r.runs.map((x) => x.outcome).join(", ") || "none"}`} />
                </span>
                <VerdictPill verdict={r.verdict} />
              </Link>
            </li>
          ))}
        </ul>
        {rows.length === 0 && <p className="m-0 px-5 pb-4 pt-1 text-callout text-fg-3">{emptyText}</p>}
      </div>
      {next && <div className="border-t border-border-soft bg-s2/40 px-5 py-4">{next}</div>}
    </section>
  );
}
