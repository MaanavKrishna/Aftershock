import type { Metadata } from "next";
import Link from "next/link";
import { currentScope } from "@/lib/auth/scope";
import { TopBar, Main, PageTitle } from "@/components/app/TopBar";
import { ButtonLink } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/Pill";
import { Strip, toCells, type Cell } from "@/components/ui/Strip";
import { SOURCES } from "@/components/app/sources";
import { incidentKey } from "@/lib/domain/ids";
import { timeAgo } from "@/lib/format";
import type { IncidentSource, IncidentStatus } from "@/lib/db/schema";

export const metadata: Metadata = { title: "Incidents" };

const TABS: [IncidentStatus | "all", string][] = [["all", "All"], ["awaiting_fix", "Awaiting fix"], ["traveling", "Time traveling"], ["proven", "Proven"], ["unproven", "Unproven"]];

export default async function Incidents({ searchParams }: { searchParams: Promise<{ status?: string; source?: string }> }) {
  const sp = await searchParams;
  const status = TABS.some(([id]) => id === sp.status && id !== "all") ? (sp.status as IncidentStatus) : undefined;
  const source = sp.source && sp.source in SOURCES ? (sp.source as IncidentSource) : undefined;
  const { scope } = await currentScope();
  const [ws, rows, counts] = await Promise.all([scope.workspace(), scope.incidentRows({ status, source }), scope.statusCounts()]);
  const q = (next: { status?: string; source?: string }) => {
    const p = new URLSearchParams();
    const st = "status" in next ? next.status : status;
    const so = "source" in next ? next.source : source;
    if (st && st !== "all") p.set("status", st);
    if (so && so !== "all") p.set("source", so);
    const s = p.toString();
    return `/incidents${s ? `?${s}` : ""}`;
  };
  return (
    <>
      <TopBar title="Incidents">
        <ButtonLink href="/incidents/new" className="min-h-10">New incident</ButtonLink>
      </TopBar>
      <Main>
        <PageTitle title="A failure is a starting point." sub="Every incident here is on its way to becoming a proven test — or says why it isn’t." />
        <nav aria-label="Filter by status" className="grid grid-cols-[repeat(auto-fit,minmax(min(150px,100%),1fr))] gap-2">
          {TABS.map(([id, label]) => {
            const on = (status ?? "all") === id;
            return (
              <Link key={id} href={q({ status: id })} aria-current={on ? "page" : undefined} className={`flex flex-col items-start gap-0.5 rounded-xl bg-white px-4 py-3 text-inherit no-underline ${on ? "border-2 border-ink" : "border border-line"}`}>
                <span className={`text-[12.5px] ${id === "awaiting_fix" ? "text-fail-deep" : "text-muted"}`}>{label}</span>
                <span className="font-mono text-2xl font-semibold tracking-[-0.02em]">{counts[id] ?? 0}</span>
              </Link>
            );
          })}
        </nav>
        <nav aria-label="Filter by source" className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[12.5px] text-muted">Source</span>
          {([["all", "All"], ...Object.entries(SOURCES).map(([k, v]) => [k, v[0]])] as [string, string][]).map(([id, label]) => {
            const on = (source ?? "all") === id;
            return (
              <Link key={id} href={q({ source: id })} aria-current={on ? "page" : undefined} className={`inline-flex min-h-9 items-center rounded-full px-3 text-[13px] no-underline ${on ? "border border-ink bg-ink text-white" : "border border-line-strong bg-white text-body"}`}>{label}</Link>
            );
          })}
        </nav>
        <section className="overflow-hidden rounded-[14px] border border-line bg-card shadow-[0_1px_2px_rgba(14,20,27,0.04)]">
          <div className="overflow-x-auto">
            <div className="min-w-[820px]">
              <div className="grid grid-cols-[76px_minmax(0,2.6fr)_1.2fr_1.1fr_1fr_110px] gap-3.5 border-b border-[#EDEEE9] bg-[#FAFAF8] px-5 py-[11px] text-xs text-muted-2">
                <span>ID</span><span>Incident</span><span>Source</span><span>Proof</span><span>Status</span><span>Updated</span>
              </div>
              {rows.map(({ incident: i, repo, run }) => {
                const href = i.status === "traveling" || i.status === "unproven" || i.status === "rejected" ? `/incidents/${i.number}/travel` : `/incidents/${i.number}`;
                const cells: Cell[] = run ? [...toCells(run.beforeResults, 3).map((c) => (c === "pass" ? ("pass" as Cell) : c)), ...toCells(run.fixResults, 3)] : Array(6).fill("none");
                return (
                  <Link key={i.id} href={href} className="grid grid-cols-[76px_minmax(0,2.6fr)_1.2fr_1.1fr_1fr_110px] items-center gap-3.5 border-b border-line-soft px-5 py-3.5 text-inherit no-underline hover:bg-[#FAFAF8]">
                    <span className="font-mono text-[12.5px] text-muted">{incidentKey(ws?.incidentPrefix ?? "INC", i.number)}</span>
                    <span className="flex min-w-0 flex-col"><span className="truncate font-semibold">{i.title}</span><span className="font-mono text-xs text-muted-2">{repo?.name ?? "no repository"}</span></span>
                    <span className="inline-flex items-center gap-2 text-[13px] text-body">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={SOURCES[i.source][1]} /></svg>
                      {SOURCES[i.source][0]}
                    </span>
                    <Strip cells={cells} width={96} label={run ? `before the fix ${run.beforeResults.map((r) => r.outcome).join(", ") || "not run"}; on the fix ${run.fixResults.map((r) => r.outcome).join(", ") || "not run"}` : "not run"} />
                    <span className="justify-self-start"><StatusPill status={i.status} /></span>
                    <span className="text-[12.5px] text-muted">{timeAgo(i.updatedAt)}</span>
                  </Link>
                );
              })}
              {rows.length === 0 && <div className="px-5 py-12 text-center text-muted">No incidents match these filters.</div>}
            </div>
          </div>
        </section>
        <div className="flex flex-wrap gap-x-[18px] gap-y-1.5 text-[12.5px] text-muted">
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[2px] bg-fail" />failed</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[2px] bg-pass" />passed</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[2px] bg-line" />not run</span>
          <span>First three cells: before the fix. Last three: on the fix.</span>
        </div>
      </Main>
    </>
  );
}
