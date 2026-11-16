import type { Metadata } from "next";
import Link from "next/link";
import { currentScope } from "@/lib/auth/scope";
import { TopBar, Main, PageTitle } from "@/components/app/TopBar";
import { VerdictPill } from "@/components/ui/Pill";
import { Tabs } from "@/components/ui/Tabs";
import { Table, THead, Th, Tr, Td } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/Feedback";
import { Strip, toCells } from "@/components/ui/Strip";
import { duration, timeAgo } from "@/lib/format";
import type { CheckVerdict } from "@/lib/db/schema";

export const metadata: Metadata = { title: "Pull requests" };

const FILTERS: [string, string][] = [["all", "All"], ["recur", "Recur"], ["safe", "Safe"], ["inconclusive", "Inconclusive"], ["skipped", "Skipped"]];

const HOW: [string, string, string][] = [
  ["Files", "Touches a fault line", "Any test whose watched files the pull request changes always runs."],
  ["Triage", "The model adds related incidents", "It can add tests to run, never remove one chosen by files."],
  ["Run", "Three runs on the head commit", "All fail: Recur. All pass: Safe. Anything else: Inconclusive."],
];

export default async function Pulls({ searchParams }: { searchParams: Promise<{ verdict?: string }> }) {
  const { verdict: v } = await searchParams;
  const verdict = FILTERS.some(([id]) => id === v && id !== "all") ? (v as CheckVerdict) : undefined;
  const { scope } = await currentScope();
  const [rows, counts] = await Promise.all([scope.checks({ verdict }), scope.verdictCounts()]);
  return (
    <>
      <TopBar title="Pull requests" />
      <Main>
        <PageTitle title="Every change, checked against what already broke." sub="Only the incidents a change could reopen are run. The rest are skipped with a reason you can read. Checks start when a pull request opens or updates." />
        <Tabs label="Filter by verdict" items={FILTERS.map(([id, label]) => ({ href: id === "all" ? "/pulls" : `/pulls?verdict=${id}`, label, active: (verdict ?? "all") === id, count: counts[id] ?? 0 }))} />
        {rows.length === 0 ? (
          <EmptyState title="No checks with this verdict yet">Pull requests appear here as soon as the GitHub App sees them open or update.</EmptyState>
        ) : (
          <Table label="Pull request checks">
            <THead>
              <tr>
                <Th className="w-20">PR</Th>
                <Th>Change</Th>
                <Th className="max-md:hidden">Tests run</Th>
                <Th className="max-lg:hidden">Runner</Th>
                <Th className="max-sm:hidden">Runs</Th>
                <Th>Verdict</Th>
              </tr>
            </THead>
            <tbody>
              {rows.map(({ check, repo, results, skipped }) => {
                const runs = results.flatMap((r) => r.runs);
                return (
                  <Tr key={check.id} className="relative">
                    <Td className="whitespace-nowrap font-mono text-callout text-fg-3">#{check.prNumber}</Td>
                    <Td className="w-full min-w-48 max-w-0">
                      <Link href={`/pulls/${check.prNumber}?repo=${repo.name}`} className="flex flex-col py-1 no-underline after:absolute after:inset-0 after:content-['']">
                        <span className="truncate font-medium text-fg">{check.title}</span>
                        <span className="truncate text-caption text-fg-3">
                          {repo.name} · {check.filesChanged} file{check.filesChanged === 1 ? "" : "s"} · {timeAgo(check.createdAt)}
                        </span>
                      </Link>
                    </Td>
                    <Td className="whitespace-nowrap text-callout max-md:hidden">{check.status === "done" || results.length ? `${results.length} run · ${skipped} skipped` : "Selecting…"}</Td>
                    <Td className="whitespace-nowrap text-callout max-lg:hidden">
                      {check.runner ?? "—"}
                      {check.durationMs ? <span className="text-fg-3"> · {duration(check.durationMs)}</span> : null}
                    </Td>
                    <Td className="max-sm:hidden">
                      <Strip
                        cells={check.status === "running" && runs.length === 0 ? ["running", "running", "running"] : toCells(runs, Math.max(3, Math.min(9, runs.length)))}
                        width={72}
                        height={8}
                        label={runs.length ? `Runs: ${runs.map((r) => r.outcome).join(", ")}` : "No runs"}
                      />
                    </Td>
                    <Td>
                      <VerdictPill verdict={check.verdict} />
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
        <section aria-labelledby="how-h" className="flex flex-col gap-3">
          <h2 id="how-h" className="m-0 text-title-3 font-semibold text-fg">
            How a check chooses its tests
          </h2>
          <ol className="m-0 grid list-none gap-3 p-0 md:grid-cols-3">
            {HOW.map(([k, t, d], i) => (
              <li key={k} className="flex flex-col gap-1 rounded-card border border-border bg-s1 px-5 py-4">
                <span className="text-caption text-fg-3">
                  {i + 1} · {k}
                </span>
                <span className="text-ui font-medium text-fg">{t}</span>
                <span className="text-callout text-fg-2">{d}</span>
              </li>
            ))}
          </ol>
        </section>
      </Main>
    </>
  );
}
