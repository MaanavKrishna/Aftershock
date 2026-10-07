import Link from "next/link";
import { currentScope } from "@/lib/auth/scope";
import { TopBar, Main, PageTitle } from "@/components/app/TopBar";
import { VerdictPill } from "@/components/ui/Pill";
import { Strip, toCells } from "@/components/ui/Strip";
import type { CheckVerdict } from "@/lib/db/schema";

const FILTERS: [string, string][] = [["all", "All"], ["recur", "Recur"], ["safe", "Safe"], ["inconclusive", "Inconclusive"], ["skipped", "Skipped"]];

export default async function Pulls({ searchParams }: { searchParams: Promise<{ verdict?: string }> }) {
  const { verdict: v } = await searchParams;
  const verdict = FILTERS.some(([id]) => id === v && id !== "all") ? (v as CheckVerdict) : undefined;
  const { scope } = await currentScope();
  const [rows, counts] = await Promise.all([scope.checks({ verdict }), scope.verdictCounts()]);
  const cols = "grid-cols-[64px_minmax(0,2.4fr)_1.1fr_1fr_1fr_110px]";
  return (
    <>
      <TopBar title="Pull requests"><span className="text-[12.5px] text-muted">Checks start when a PR opens or updates</span></TopBar>
      <Main>
        <PageTitle title="Every change, checked against what already broke." sub="Only the incidents a change could reopen are run. The rest are skipped with a reason you can read." />
        <nav aria-label="Filter by verdict" className="flex flex-wrap items-center gap-2">
          {FILTERS.map(([id, label]) => {
            const on = (verdict ?? "all") === id;
            return (
              <Link key={id} href={id === "all" ? "/pulls" : `/pulls?verdict=${id}`} aria-current={on ? "page" : undefined} className={`inline-flex min-h-[38px] items-center gap-2 rounded-full px-3.5 text-[13px] no-underline ${on ? "border border-ink bg-ink text-white" : "border border-line-strong bg-white text-body"}`}>
                {label}<span className="font-mono text-xs opacity-75">{counts[id] ?? 0}</span>
              </Link>
            );
          })}
        </nav>
        <section className="overflow-hidden rounded-[14px] border border-line bg-card shadow-[0_1px_2px_rgba(14,20,27,0.04)]">
          <div className="overflow-x-auto">
            <div className="min-w-[860px]">
              <div className={`grid ${cols} gap-3.5 border-b border-[#EDEEE9] bg-[#FAFAF8] px-5 py-[11px] text-xs text-muted-2`}><span>PR</span><span>Change</span><span>Incidents run</span><span>Runner</span><span>Result</span><span>Verdict</span></div>
              {rows.map(({ check, repo, results, skipped }) => {
                const runs = results.flatMap((r) => r.runs);
                return (
                  <Link key={check.id} href={`/pulls/${check.prNumber}?repo=${repo.name}`} className={`grid ${cols} items-center gap-3.5 border-b border-line-soft px-5 py-3.5 text-inherit no-underline hover:bg-[#FAFAF8]`}>
                    <span className="font-mono text-[12.5px] text-muted">#{check.prNumber}</span>
                    <span className="flex min-w-0 flex-col"><span className="truncate font-semibold">{check.title}</span><span className="font-mono text-xs text-muted-2">{repo.name} · {check.filesChanged} file{check.filesChanged === 1 ? "" : "s"}</span></span>
                    <span className="text-[13px] text-body">{check.status === "done" || results.length ? `${results.length} run · ${skipped} skipped` : "selecting…"}</span>
                    <span className="font-mono text-[12.5px] text-body">{check.runner ?? "—"}</span>
                    <Strip cells={check.status === "running" && runs.length === 0 ? ["running", "running", "running", "none", "none", "none"] : toCells(runs, Math.max(6, Math.min(9, runs.length)))} width={90} />
                    <span className="justify-self-start"><VerdictPill verdict={check.verdict} /></span>
                  </Link>
                );
              })}
              {rows.length === 0 && <div className="px-5 py-12 text-center text-muted">No checks with this verdict yet.</div>}
            </div>
          </div>
        </section>
        <section className="grid grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] gap-3">
          <div className="flex flex-col gap-1.5 rounded-[14px] border border-line bg-white px-5 py-[18px]"><span className="font-mono text-xs text-muted">01 · Files</span><span className="font-semibold">Touches a fault line</span><span className="text-[13px] text-muted">Any test whose watched files the PR changes always runs.</span></div>
          <div className="flex flex-col gap-1.5 rounded-[14px] border-[1.5px] border-dashed border-[#9AA1A9] bg-white px-5 py-[18px]"><span className="font-mono text-xs text-muted">02 · Triage</span><span className="font-semibold">Model adds related incidents</span><span className="text-[13px] text-muted">It can add tests to run, never remove one chosen by files.</span></div>
          <div className="flex flex-col gap-1.5 rounded-[14px] border border-line bg-white px-5 py-[18px]"><span className="font-mono text-xs text-muted">03 · Run</span><span className="font-semibold">Three runs on the head commit</span><span className="text-[13px] text-muted">All fail: Recur. All pass: Safe. Anything else: Inconclusive.</span></div>
        </section>
      </Main>
    </>
  );
}
