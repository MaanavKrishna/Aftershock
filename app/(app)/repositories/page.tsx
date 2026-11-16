import type { Metadata } from "next";
import Link from "next/link";
import { currentScope } from "@/lib/auth/scope";
import { TopBar, Main } from "@/components/app/TopBar";
import { Card, CardBody, CardHead } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { CopyText } from "@/components/ui/CopyText";
import { EmptyState, PageHeader } from "@/components/ui/Feedback";
import { Table, THead, Th, Tr, Td } from "@/components/ui/Table";
import { External, Repo } from "@/components/ui/icons";
import { deleteRepositoryAction, setRepoSetting } from "../actions";
import { ConfirmDelete } from "@/components/app/ConfirmDelete";
import { can } from "@/lib/auth/roles";
import { hours, timeAgo } from "@/lib/format";
import type { RepositoryRow } from "@/lib/db/schema";
import { flagEnabled } from "@/lib/flags";

export const metadata: Metadata = { title: "Repositories" };

/**
 * A two-way choice that saves on click. Each option is a submit button with aria-pressed,
 * so it works without JavaScript; it looks like the Segmented control.
 */
function Segment({ repo, field, label, options, value }: { repo: RepositoryRow; field: string; label: string; options: [string, string][]; value: string }) {
  return (
    <form action={setRepoSetting} role="group" aria-label={`${label} for ${repo.name}`} className="inline-flex rounded-control bg-s2 p-0.5">
      <input type="hidden" name="repoId" value={repo.id} />
      <input type="hidden" name="field" value={field} />
      {options.map(([v, l]) => (
        <button
          key={v}
          type="submit"
          name="value"
          value={v}
          aria-pressed={value === v}
          className={`inline-flex min-h-8 cursor-pointer items-center rounded-lg px-3 text-callout font-medium transition-[background-color,color,box-shadow] duration-150 ease-fl ${value === v ? "bg-s1 text-fg shadow-e1" : "bg-transparent text-fg-3 hover:text-fg"}`}
        >
          {l}
        </button>
      ))}
    </form>
  );
}

export default async function Repositories({ searchParams }: { searchParams: Promise<{ repo?: string }> }) {
  const { repo: selName } = await searchParams;
  const { scope, session } = await currentScope();
  const [repos, mem, usage, byRepo, ws, me] = await Promise.all([scope.repos(), scope.memoryCountByRepo(), scope.usage(), scope.usageByRepo(), scope.workspace(), scope.me(session.userId)]);
  const admin = can(me?.role, "manageRepositories");
  const sel = repos.find((r) => r.name === selName) ?? repos[0];
  const parts = [...byRepo.checks.map((c) => ({ name: c.repo, ms: c.ms })), { name: "time travel", ms: byRepo.travelMs }].filter((p) => p.ms > 0).sort((a, b) => b.ms - a.ms);
  const partTotal = parts.reduce((a, p) => a + p.ms, 0) || 1;
  const usedPct = Math.min(100, (usage.sandboxCpuMs / usage.allowanceMs) * 100);
  const installUrl = process.env.GITHUB_APP_SLUG ? `https://github.com/apps/${process.env.GITHUB_APP_SLUG}/installations/new` : null;
  const publicRepos = repos.filter((r) => r.isPrivate === false);
  const appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");
  return (
    <>
      <TopBar title="Repositories" />
      <Main>
        <PageHeader
          title="Where checks run, and how hard they push back."
          sub="Each repository picks a runner and whether a recurrence blocks the merge."
          actions={
            installUrl && (
              <ButtonLink href={installUrl} variant="secondary">
                Add on GitHub
                <External size={14} />
              </ButtonLink>
            )
          }
        />

        {repos.length === 0 ? (
          <EmptyState title="No repositories yet" icon={<Repo size={18} />} action={installUrl ? <ButtonLink href={installUrl}>Install the GitHub App</ButtonLink> : undefined}>
            Install the GitHub App on the repositories you want to protect, and they appear here.
          </EmptyState>
        ) : (
          <Table label="Repositories">
            <THead>
              <tr>
                <Th className="min-w-[220px]">Repository</Th>
                <Th>Tests</Th>
                <Th>Runner</Th>
                <Th>On recurrence</Th>
                <Th className="text-right">Memory</Th>
              </tr>
            </THead>
            <tbody>
              {repos.map((r) => (
                <Tr key={r.id} className={sel?.id === r.id ? "bg-s2/40" : ""}>
                  <Td className="py-3">
                    <Link href={`/repositories?repo=${r.name}`} aria-current={sel?.id === r.id ? "true" : undefined} className="flex min-w-0 flex-col no-underline">
                      <span className="font-mono text-callout font-semibold text-fg hover:underline">{r.name}</span>
                      <span className="text-caption text-fg-3">
                        {r.language} · last check {timeAgo(r.lastCheckAt).toLowerCase()}
                      </span>
                    </Link>
                  </Td>
                  <Td className="font-mono text-callout">{r.framework}</Td>
                  <Td>
                    <Segment repo={r} field="runner" label="Runner" value={r.runner} options={[["sandbox", "Sandbox"], ["actions", "Actions"]]} />
                  </Td>
                  <Td>
                    <Segment repo={r} field="checkMode" label="Check mode" value={r.checkMode} options={[["blocking", "Block"], ["advisory", "Warn"]]} />
                  </Td>
                  <Td className="whitespace-nowrap text-right">
                    <span className="font-semibold text-fg">{mem[r.id] ?? 0}</span> tests
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}

        <div className="grid items-start gap-4 lg:grid-cols-2">
          <Card>
            <CardHead sub="Active CPU only. Resets on the 1st.">Sandbox usage this month</CardHead>
            <CardBody className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-title-1 font-semibold tabular-nums text-fg">{hours(usage.sandboxCpuMs)}</span>
                  <span className="text-callout tabular-nums text-fg-3">of {hours(usage.allowanceMs)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-s2" role="img" aria-label={`${hours(usage.sandboxCpuMs)} used of ${hours(usage.allowanceMs)}`}>
                  <span className={`block h-full rounded-full ${usedPct >= 100 ? "bg-recur" : "bg-fg-2"}`} style={{ width: `${usedPct}%` }} />
                </div>
              </div>
              {parts.length > 0 && (
                <div className="flex flex-col gap-1">
                  <h3 className="m-0 text-callout font-medium text-fg-3">Where it went</h3>
                  <ul className="m-0 flex list-none flex-col p-0">
                    {parts.map((p) => {
                      const pct = Math.round((p.ms / partTotal) * 100);
                      return (
                        <li key={p.name} className="grid grid-cols-[minmax(0,1fr)_minmax(0,120px)_40px] items-center gap-3 border-b border-border-soft py-2 last:border-b-0">
                          <span className="truncate font-mono text-callout text-fg">{p.name}</span>
                          <span aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-s2">
                            <span className="block h-full rounded-full bg-fg-3" style={{ width: `${pct}%` }} />
                          </span>
                          <span className="text-right text-callout tabular-nums text-fg-2">{pct}%</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              <p className="m-0 rounded-control bg-s2 px-3.5 py-3 text-callout text-fg-2">At the limit, pull request checks move to GitHub Actions for repositories that have the workflow installed. Time travel waits until the reset.</p>
            </CardBody>
          </Card>

          {sel && (
            <div className="flex min-w-0 flex-col gap-4">
              <Card>
                <CardHead sub="Commit this file to the default branch to keep these settings with your code. It overrides the settings above.">Configuration as code</CardHead>
                <CardBody>
                  <CodeBlock
                    file={`${sel.name} · .aftershock/config.yaml`}
                    code={`framework: ${sel.framework}\nrunner: ${sel.runner}\ninstall: ${sel.installCmd}\ntest_dir: ${sel.testDir}\ncheck:\n  mode: ${sel.checkMode}\n  runs: 3\nincidents:\n  issue_label: ${ws?.settings.issueLabel ?? "incident"}`}
                  />
                </CardBody>
              </Card>
              {admin && (
                <Card>
                  <CardHead sub="Stops checks and deletes its memory tests, check history and cached environments. Incidents stay.">Remove {sel.name}</CardHead>
                  <CardBody>
                    <ConfirmDelete action={deleteRepositoryAction} fields={{ repoId: sel.id }} expected={sel.name} button="Remove repository" description="Also remove the repository from the GitHub App on GitHub, or it is added back the next time GitHub sends an event." />
                  </CardBody>
                </Card>
              )}
            </div>
          )}
        </div>

        {flagEnabled("badge", ws?.settings) && publicRepos.length > 0 && (
          <Card>
            <CardHead sub="Public repositories only. Private ones never get a badge.">README badge</CardHead>
            <ul className="m-0 flex list-none flex-col p-0">
              {publicRepos.map((r) => {
                const md = `[![Incidents remembered](${appUrl}/api/badge/${r.fullName}.svg)](https://aftershock-mk.vercel.app)`;
                return (
                  <li key={r.id} className="flex flex-col gap-2 border-b border-border-soft px-5 py-4 last:border-b-0">
                    <span className="font-mono text-callout font-semibold text-fg">{r.name}</span>
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="min-w-0 flex-1 break-all rounded-chip bg-sunken px-2.5 py-2 font-mono text-caption text-fg-2">{md}</code>
                      <CopyText text={md} label="Copy Markdown" />
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </Main>
    </>
  );
}
