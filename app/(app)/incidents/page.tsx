import type { Metadata } from "next";
import Link from "next/link";
import { currentScope } from "@/lib/auth/scope";
import { TopBar, Main, PageTitle } from "@/components/app/TopBar";
import { ButtonLink } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/Pill";
import { Tabs } from "@/components/ui/Tabs";
import { Table, THead, Th, Tr, Td } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/Feedback";
import { Plus } from "@/components/ui/icons";
import { Strip, toCells, type Cell } from "@/components/ui/Strip";
import { FilterChips } from "@/components/app/bits";
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
  const sources = ["all", ...Object.keys(SOURCES)];
  return (
    <>
      <TopBar title="Incidents" />
      <Main>
        <PageTitle
          title="A failure is a starting point."
          sub="Every incident here is on its way to becoming a proven test, or says why it isn’t."
          actions={
            <ButtonLink href="/incidents/new" size="sm">
              <Plus size={15} />
              New incident
            </ButtonLink>
          }
        />
        <div className="flex flex-col gap-3">
          <Tabs label="Filter by status" items={TABS.map(([id, label]) => ({ href: q({ status: id }), label, active: (status ?? "all") === id, count: counts[id] ?? 0 }))} />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-callout text-fg-3">Source</span>
            <FilterChips label="Filter by source" items={sources.map((id) => ({ href: q({ source: id }), label: id === "all" ? "All" : SOURCES[id as IncidentSource][0], active: (source ?? "all") === id }))} />
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyState title="No incidents match these filters" action={<ButtonLink href="/incidents" variant="secondary" size="sm">Clear filters</ButtonLink>}>
            Try another status or source, or bring a new incident in.
          </EmptyState>
        ) : (
          <Table label="Incidents">
            <THead>
              <tr>
                <Th className="w-24">ID</Th>
                <Th>Incident</Th>
                <Th className="max-md:hidden">Source</Th>
                <Th className="max-sm:hidden">Proof</Th>
                <Th>Status</Th>
                <Th className="text-right max-md:hidden">Updated</Th>
              </tr>
            </THead>
            <tbody>
              {rows.map(({ incident: i, repo, run }) => {
                const href = i.status === "traveling" || i.status === "unproven" || i.status === "rejected" ? `/incidents/${i.number}/travel` : `/incidents/${i.number}`;
                const cells: Cell[] = run ? [...toCells(run.beforeResults, 3), ...toCells(run.fixResults, 3)] : Array(6).fill("none");
                return (
                  <Tr key={i.id} className="relative">
                    <Td className="font-mono text-callout text-fg-3">{incidentKey(ws?.incidentPrefix ?? "INC", i.number)}</Td>
                    <Td className="max-w-0 w-full min-w-48">
                      <Link href={href} className="flex flex-col py-1 no-underline after:absolute after:inset-0 after:content-['']">
                        <span className="truncate font-medium text-fg">{i.title}</span>
                        <span className="truncate text-caption text-fg-3">{repo?.name ?? "no repository"}</span>
                      </Link>
                    </Td>
                    <Td className="whitespace-nowrap text-callout max-md:hidden">
                      <span className="inline-flex items-center gap-2">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-fg-3">
                          <path d={SOURCES[i.source][1]} />
                        </svg>
                        {SOURCES[i.source][0]}
                      </span>
                    </Td>
                    <Td className="max-sm:hidden">
                      <span className="flex items-center gap-1">
                        <Strip
                          cells={cells.slice(0, 3)}
                          width={40}
                          height={8}
                          label={run ? `Before the fix: ${run.beforeResults.map((r) => r.outcome).join(", ") || "not run"}` : "Not run"}
                        />
                        <span className="text-fg-3" aria-hidden="true">→</span>
                        <Strip cells={cells.slice(3)} width={40} height={8} label={run ? `On the fix: ${run.fixResults.map((r) => r.outcome).join(", ") || "not run"}` : "Not run"} />
                      </span>
                    </Td>
                    <Td>
                      <StatusPill status={i.status} />
                    </Td>
                    <Td className="whitespace-nowrap text-right text-callout text-fg-3 max-md:hidden">{timeAgo(i.updatedAt)}</Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
        <p className="m-0 text-caption text-fg-3">Proof shows three runs before the fix (they must fail) and three on the fix (they must pass).</p>
      </Main>
    </>
  );
}
