import Link from "next/link";
import { Strip, toCells } from "@/components/ui/Strip";
import { VerdictPill } from "@/components/ui/Pill";
import type { PrCheckRow, RepositoryRow, CheckVerdict } from "@/lib/db/schema";
import type { RunResult } from "@/lib/domain/verdict";
import { duration } from "@/lib/format";

export const DOT: Record<string, string> = { pass: "bg-pass", fail: "bg-fail", neutral: "bg-[#9AA1A9]", pending: "border-2 border-ink bg-white" };

export function CheckRow({ check, repo, results, skipped }: { check: PrCheckRow; repo: RepositoryRow; results: { runs: RunResult[] }[]; skipped: number }) {
  const runs = results.flatMap((r) => r.runs);
  return (
    <Link href={`/pulls/${check.prNumber}?repo=${repo.name}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line-soft px-5 py-[13px] text-inherit no-underline hover:bg-[#FAFAF8]">
      <span className="w-12 font-mono text-[12.5px] text-muted-2">#{check.prNumber}</span>
      <span className="flex min-w-0 flex-[1_1_220px] flex-col">
        <span className="truncate font-semibold">{check.title}</span>
        <span className="font-mono text-xs text-muted-2">
          {repo.name} · {results.length} relevant{skipped ? ` · ${skipped} skipped` : ""}
        </span>
      </span>
      <span className="w-[120px] whitespace-nowrap font-mono text-xs text-muted">{check.runner ? `${check.runner} · ${duration(check.durationMs)}` : "—"}</span>
      <span className="w-[90px]"><Strip cells={toCells(runs, Math.max(3, Math.min(6, runs.length)))} /></span>
      <VerdictPill verdict={check.verdict as CheckVerdict | null} />
    </Link>
  );
}
