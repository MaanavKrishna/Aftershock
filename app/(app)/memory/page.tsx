import type { Metadata } from "next";
import Link from "next/link";
import { currentScope } from "@/lib/auth/scope";
import { TopBar, Main, PageTitle } from "@/components/app/TopBar";
import { Card, CardHead } from "@/components/ui/Card";
import { Verdict, type VerdictKind } from "@/components/ui/Verdict";
import { ButtonLink, buttonClass } from "@/components/ui/Button";
import { Table, THead, Th, Tr, Td } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/Feedback";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { Memory } from "@/components/ui/icons";
import { FilterChips } from "@/components/app/bits";
import { LessonsSync } from "@/components/app/LessonsSync";
import { incidentKey } from "@/lib/domain/ids";
import { renderLessons } from "@/lib/domain/lessons";
import { stamp, timeAgo, word } from "@/lib/format";
import { measureStrength, releaseQuarantine, reproveNow } from "../actions";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { flagEnabled } from "@/lib/flags";

export const metadata: Metadata = { title: "Memory" };

const GUARD: Record<string, [VerdictKind, string]> = { guarding: ["healthy", "Still guarding"], weak: ["weak", "Weak"], drifted: ["drifted", "Drifted"] };
const HEALTH: Record<string, [VerdictKind, string]> = { healthy: ["healthy", "Healthy"], flaky: ["flaky", "Flaky"], failing: ["failing", "Failing on main"] };

function Strength({ score }: { score: number }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-1 w-12 overflow-hidden rounded-full bg-s3" aria-hidden="true">
        <span className={`block h-full rounded-full ${score >= 60 ? "bg-fg-2" : "bg-inconclusive"}`} style={{ width: `${score}%` }} />
      </span>
      <span className={`text-callout tabular-nums ${score >= 60 ? "text-fg-2" : "text-inconclusive"}`}>{score}%</span>
    </span>
  );
}

/** A labs action row inside the detail panel: what it does, then the button. */
function Action({ action, id, text, button, pending }: { action: (f: FormData) => Promise<void>; id: string; text: string; button: string; pending: string }) {
  return (
    <form action={action} className="flex flex-wrap items-center gap-3 border-t border-border-soft px-5 py-3">
      <input type="hidden" name="memoryTestId" value={id} />
      <span className="flex-[1_1_220px] text-callout text-fg-2">{text}</span>
      <SubmitButton className={buttonClass("secondary", "sm")} pendingLabel={pending}>
        {button}
      </SubmitButton>
    </form>
  );
}

export default async function MemoryPage({ searchParams }: { searchParams: Promise<{ repo?: string; test?: string }> }) {
  const sp = await searchParams;
  const { scope } = await currentScope();
  const [ws, all, repos] = await Promise.all([scope.workspace(), scope.memory(), scope.repos()]);
  const quarantineEnforced = flagEnabled("quarantineEnforce", ws?.settings);
  const reproofOn = flagEnabled("reproof", ws?.settings);
  const strengthOn = flagEnabled("testStrength", ws?.settings);
  const prefix = ws?.incidentPrefix ?? "INC";
  const rows = all.filter((r) => !sp.repo || r.repo.name === sp.repo);
  const sel = rows.find((r) => r.test.id === sp.test) ?? rows[0];
  const q = (p: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    const repo = "repo" in p ? p.repo : sp.repo;
    if (repo) u.set("repo", repo);
    if (p.test) u.set("test", p.test);
    return `/memory${u.size ? `?${u}` : ""}`;
  };
  const lessons = renderLessons(all.map((r) => ({ key: incidentKey(prefix, r.incident.number), title: r.incident.title, files: r.incident.watchedFiles, expected: r.incident.expected, testPath: r.test.path })));
  const n = all.length;
  const nights = sel ? (sel.test.nights.length ? sel.test.nights : (Array(14).fill(null) as (boolean | null)[])) : [];
  const failedNights = sel ? sel.test.nights.filter((x) => !x).length : 0;
  const unwell = all.filter((r) => r.test.health !== "healthy").length;
  return (
    <>
      <TopBar title="Memory">
        <a href="/api/v1/lessons" download="LESSONS.md" className={buttonClass("secondary", "sm", "max-sm:hidden")}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 4v11" />
            <path d="m7 10 5 5 5-5" />
            <path d="M5 20h14" />
          </svg>
          Export LESSONS.md
        </a>
      </TopBar>
      <Main>
        <PageTitle
          title={n === 0 ? "No lessons yet." : `${word(n)} ${n === 1 ? "lesson" : "lessons"} your codebase can’t forget.`}
          sub="Every test here failed before its fix and passed after. Each night they run again on your default branch to stay honest."
        />
        {n > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <FilterChips label="Repository" items={[["", "All repositories"], ...repos.map((r) => [r.name, r.name])].map(([id, label]) => ({ href: q({ repo: id || undefined }), label, active: (sp.repo ?? "") === id }))} />
            <span className="text-callout text-fg-3">
              {rows.length} {rows.length === 1 ? "test" : "tests"}
              {unwell ? ` · ${unwell} need a look` : " · all healthy"}
            </span>
          </div>
        )}
        {n === 0 ? (
          <EmptyState title="No lessons yet" icon={<Memory size={18} />} action={<ButtonLink href="/incidents/new" size="sm">Import an incident</ButtonLink>}>
            Import one fixed incident. Aftershock travels back through your history and proves a test for it.
          </EmptyState>
        ) : (
          <div className="grid items-start gap-4 xl:grid-cols-5">
            <div className="min-w-0 xl:col-span-3">
              <Table label="Memory tests">
                <THead>
                  <tr>
                    <Th>Test</Th>
                    <Th>Health</Th>
                    <Th className="max-md:hidden">Strength</Th>
                    <Th className="text-right max-sm:hidden">Guarded</Th>
                    <Th className="text-right max-sm:hidden">Blocked</Th>
                  </tr>
                </THead>
                <tbody>
                  {rows.map((r) => {
                    const on = sel?.test.id === r.test.id;
                    const [kind, label] = HEALTH[r.test.health];
                    return (
                      <Tr key={r.test.id} className={`relative ${on ? "shadow-[inset_2px_0_0_var(--color-signal)]" : ""}`} aria-selected={on || undefined}>
                        <Td className="w-full min-w-48 max-w-0">
                          <Link href={q({ test: r.test.id })} aria-current={on ? "true" : undefined} className="flex flex-col py-1 no-underline after:absolute after:inset-0 after:content-['']">
                            <span className="flex min-w-0 items-baseline gap-2">
                              <span className="shrink-0 font-mono text-caption text-fg-3">{incidentKey(prefix, r.incident.number)}</span>
                              <span className="truncate font-medium text-fg">{r.incident.title}</span>
                            </span>
                            <span className="truncate font-mono text-caption text-fg-3">{r.test.fn}</span>
                          </Link>
                        </Td>
                        <Td>
                          <span className="flex flex-col items-start gap-1">
                            <Verdict kind={kind} label={label === "Failing on main" ? "Failing" : label} size="sm" />
                            {r.test.quarantined && <Verdict kind="skipped" label="Quarantined" size="sm" />}
                          </span>
                        </Td>
                        <Td className="max-md:hidden">{r.test.strength ? <Strength score={r.test.strength.score} /> : <span className="text-callout text-fg-3">—</span>}</Td>
                        <Td className="text-right text-callout max-sm:hidden">{r.guarded}</Td>
                        <Td className={`text-right text-callout max-sm:hidden ${r.blocked ? "font-medium text-recur" : ""}`}>{r.blocked}</Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
            {sel && (
              <aside className="flex min-w-0 flex-col gap-4 xl:col-span-2" aria-label="Selected test">
                <Card>
                  <div className="flex flex-col gap-2 px-5 py-4">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="mr-1 font-mono text-caption text-fg-3">
                        {incidentKey(prefix, sel.incident.number)} · {sel.repo.name}
                      </span>
                      <Verdict kind={HEALTH[sel.test.health][0]} label={HEALTH[sel.test.health][1]} size="sm" />
                      {sel.test.quarantined && <Verdict kind="skipped" label="Quarantined" size="sm" />}
                      {sel.test.guardStatus && <Verdict kind={GUARD[sel.test.guardStatus][0]} label={GUARD[sel.test.guardStatus][1]} size="sm" />}
                    </div>
                    <h2 className="m-0 text-title-3 font-semibold text-fg">{sel.incident.title}</h2>
                    <span className="break-all font-mono text-caption text-fg-3">{sel.test.path}</span>
                  </div>
                  <dl className="m-0 grid grid-cols-3 border-t border-border-soft">
                    {(
                      [
                        ["Guarded", String(sel.guarded), ""],
                        ["Blocked", String(sel.blocked), sel.blocked ? "text-recur" : ""],
                        ["Proven", stamp(sel.test.provenAt).split(",")[0], ""],
                      ] as const
                    ).map(([k, v, c], i) => (
                      <div key={k} className={`flex flex-col gap-0.5 px-5 py-3 ${i < 2 ? "border-r border-border-soft" : ""}`}>
                        <dt className="text-caption text-fg-3">{k}</dt>
                        <dd className={`m-0 text-title-3 font-semibold tabular-nums text-fg ${c}`}>{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="flex flex-col gap-2 border-t border-border-soft px-5 py-4">
                    <span className="text-caption text-fg-3">Nightly on main · last {nights.length} nights</span>
                    <div className="flex gap-0.5" role="img" aria-label={`${failedNights} failing nights of ${sel.test.nights.length}`}>
                      {nights.map((ok, i) => (
                        <span key={i} className={`h-4 flex-1 rounded-xs ${ok === null ? "bg-s3" : ok ? "bg-proven" : "bg-recur"}`} />
                      ))}
                    </div>
                    <span className="text-callout text-fg-2">
                      {sel.test.health === "failing"
                        ? "Started failing on main. Something merged around the check; open the incident."
                        : sel.test.health === "flaky"
                          ? `${failedNights} failure${failedNights === 1 ? "" : "s"} in ${sel.test.nights.length} nights. Flaky tests are reported, never silently retried to green.`
                          : "Passing every night on the default branch."}
                    </span>
                  </div>
                  {sel.test.quarantined && (
                    <Action
                      action={releaseQuarantine}
                      id={sel.test.id}
                      text={`${sel.test.quarantineReason}. ${quarantineEnforced ? "It is skipped on pull requests until seven green nights." : "Recorded only: turn on quarantine in Labs to skip it on pull requests."}`}
                      button="Release"
                      pending="Releasing…"
                    />
                  )}
                  {strengthOn && (
                    <Action
                      action={measureStrength}
                      id={sel.test.id}
                      text={
                        sel.test.strength
                          ? `Catches ${sel.test.strength.killed} of ${sel.test.strength.total} small changes to the fixed lines.${sel.test.strength.survivors[0] ? ` Misses: ${sel.test.strength.survivors[0].file}:${sel.test.strength.survivors[0].line} → “${sel.test.strength.survivors[0].to.trim()}”.` : ""}`
                          : "Strength not measured yet: small changes are made to the fixed lines and this test should catch them."
                      }
                      button="Measure strength"
                      pending="Starting…"
                    />
                  )}
                  {reproofOn && (
                    <Action
                      action={reproveNow}
                      id={sel.test.id}
                      text={sel.test.guardCheckedAt ? `${sel.test.guardDetail} (checked ${timeAgo(sel.test.guardCheckedAt).toLowerCase()}).` : "Not re-proved yet. Re-proofs undo the fix on today's main and expect this test to fail; they run every Sunday."}
                      button="Re-prove now"
                      pending="Starting…"
                    />
                  )}
                  <div className="flex flex-col gap-2 border-t border-border-soft px-5 py-4">
                    <span className="text-caption text-fg-3">Runs when a pull request touches</span>
                    <div className="flex flex-wrap gap-1.5">
                      {sel.incident.watchedFiles.map((w) => (
                        <span key={w} className="rounded-chip bg-s2 px-2 py-0.5 font-mono text-caption text-fg-2">
                          {w}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 border-t border-border-soft px-5 py-3.5">
                    <ButtonLink href={`/incidents/${sel.incident.number}`} size="sm">
                      Open incident
                    </ButtonLink>
                    <ButtonLink href={`/incidents/${sel.incident.number}/travel`} variant="secondary" size="sm">
                      See the proof
                    </ButtonLink>
                  </div>
                </Card>
                <Card>
                  <CardHead sub="Commit it, and coding agents read your incident history before they change risky code.">LESSONS.md for coding agents</CardHead>
                  <div className="p-3 [&_pre]:max-h-72 [&_pre]:overflow-y-auto">
                    <CodeBlock code={lessons} file="LESSONS.md" />
                  </div>
                  <LessonsSync repos={repos.filter((r) => all.some((m) => m.repo.id === r.id)).map((r) => ({ id: r.id, name: r.name }))} />
                </Card>
              </aside>
            )}
          </div>
        )}
      </Main>
    </>
  );
}
