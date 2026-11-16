import type { Metadata } from "next";
import Link from "next/link";
import { currentScope } from "@/lib/auth/scope";
import { TopBar, Main, PageTitle } from "@/components/app/TopBar";
import { Card, CardHead } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/Pill";
import { Verdict } from "@/components/ui/Verdict";
import { ButtonLink } from "@/components/ui/Button";
import { Badge, EmptyState } from "@/components/ui/Feedback";
import { ArrowRight, Check, Plus } from "@/components/ui/icons";
import { CheckRow, TONE_DOT } from "@/components/app/bits";
import { CountUp } from "@/components/app/CountUp";
import { incidentKey } from "@/lib/domain/ids";
import { timeAgo, word } from "@/lib/format";
import { SOURCES } from "@/components/app/sources";

export const metadata: Metadata = { title: "Overview" };

function More({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex min-h-8 items-center gap-1 rounded-chip px-2 text-callout font-medium text-signal no-underline hover:bg-signal-soft">
      {children}
      <ArrowRight size={14} />
    </Link>
  );
}

export default async function Overview() {
  const { scope } = await currentScope();
  // Counts and short lists in one batch; the newest incidents, the unwell memory tests and six activity
  // entries are bounded reads beside it (the summary has none of the first two and five activity entries).
  const [summary, recent, failing, flaky, activity] = await Promise.all([
    scope.overviewSummary(),
    scope.incidentPage({ limit: 5 }),
    scope.memoryPage({ health: "failing", limit: 200 }),
    scope.memoryPage({ health: "flaky", limit: 200 }),
    scope.activity(6),
  ]);
  const { workspace: ws, counts, latestRecurrence, recentChecks: checks, traveling, faults } = summary;
  const rows = recent.rows;
  const prefix = ws?.incidentPrefix ?? "INC";
  const key = (n: number) => incidentKey(prefix, n);

  const decisions = summary.decisions.map((d) =>
    d.kind === "merge_test"
      ? {
          kind: "proven" as const,
          tag: "Merge proven test",
          ref: `PR #${d.botPr}`,
          title: `${key(d.incidentNumber)} is proven. Merge the test that guards it.`,
          sub: `Aftershock opened a pull request adding ${d.path}.`,
          cta: "Review the incident",
          href: `/incidents/${d.incidentNumber}`,
        }
      : d.kind === "unproven"
        ? {
            kind: "unproven" as const,
            tag: undefined,
            ref: key(d.incident.number),
            title: d.incident.title,
            sub: d.incident.statusReason ?? "The drafts could not reproduce it.",
            cta: "Open the run",
            href: `/incidents/${d.incident.number}/travel`,
          }
        : {
            kind: "awaiting" as const,
            tag: undefined,
            ref: key(d.incident.number),
            title: d.incident.title,
            sub: `Opened from ${SOURCES[d.incident.source]?.[0] ?? "a report"} ${timeAgo(d.incident.createdAt).toLowerCase()}. Link the fix when it lands.`,
            cta: "Link a fix",
            href: `/incidents/${d.incident.number}`,
          },
  );
  const steps = [
    { label: "Install the GitHub App on a repository", done: counts.repositories > 0, href: "/repositories" },
    { label: "Bring in your first incident", done: counts.incidents > 0, href: "/incidents/new" },
    { label: "Prove a test with time travel", done: counts.memory > 0, href: "/incidents" },
    { label: "See a pull request checked", done: counts.checksEver > 0, href: "/pulls" },
  ];
  // Failing and flaky tests in the memory list's order (newest incident first).
  const unwell = [...failing.rows, ...flaky.rows].sort((a, b) => b.incident.number - a.incident.number || (a.test.id < b.test.id ? 1 : a.test.id > b.test.id ? -1 : 0));
  const unwellCount = `${unwell.length}${failing.nextCursor || flaky.nextCursor ? "+" : ""}`;
  const maxFault = Math.max(1, ...faults.map((f) => f.count));
  const n = summary.decisionCount;
  const repoCount = counts.repositories;

  const stats = [
    { k: "Proven tests in memory", v: counts.memory, sub: `across ${counts.memoryRepositories} repositories`, href: "/memory", recur: false },
    { k: "Pull requests checked", v: counts.pullsChecked7d, sub: "last 7 days", href: "/pulls", recur: false },
    {
      k: "Recurrences blocked",
      v: counts.recurrencesBlocked,
      sub: latestRecurrence ? `latest PR #${latestRecurrence.prNumber}` : "none yet",
      href: latestRecurrence ? `/pulls/${latestRecurrence.prNumber}?repo=${latestRecurrence.repoName}` : "/pulls",
      recur: counts.recurrencesBlocked > 0,
    },
    { k: "Awaiting fix", v: counts.awaitingFix, sub: "from alerts and reports", href: "/incidents?status=awaiting_fix", recur: false },
  ];

  return (
    <>
      <TopBar title="Overview" />
      <Main>
        <PageTitle
          eyebrow={`${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} · ${repoCount} ${repoCount === 1 ? "repository" : "repositories"}`}
          title={n === 0 ? "Nothing is waiting on you." : `${word(n)} ${n === 1 ? "decision is" : "decisions are"} waiting on you.`}
          actions={
            <ButtonLink href="/incidents/new" size="sm">
              <Plus size={15} />
              New incident
            </ButtonLink>
          }
        />

        {steps.some((s) => !s.done) && (
          <Card>
            <CardHead sub="Four steps to your first guarded pull request">Getting started</CardHead>
            <ol className="m-0 grid list-none gap-1 p-2 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((s, i) => (
                <li key={s.label}>
                  <Link href={s.href} className="flex min-h-11 items-center gap-2.5 rounded-control px-3 text-callout text-fg no-underline hover:bg-s2">
                    <span aria-hidden="true" className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-caption font-semibold ${s.done ? "bg-proven-soft text-proven" : "border border-border-strong text-fg-2"}`}>
                      {s.done ? <Check size={13} /> : i + 1}
                    </span>
                    <span className={s.done ? "text-fg-3 line-through" : ""}>{s.label}</span>
                    <span className="sr-only">{s.done ? "(done)" : "(to do)"}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </Card>
        )}

        <section aria-label="Key figures" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((s) => (
            <Link key={s.k} href={s.href} className="group flex flex-col gap-1 rounded-card border border-border bg-s1 px-5 py-4 text-inherit no-underline shadow-e1 transition-colors duration-150 ease-fl hover:border-border-strong">
              <span className="text-callout text-fg-3">{s.k}</span>
              <CountUp value={s.v} className={`text-title-1 font-semibold tabular-nums ${s.recur ? "text-recur" : "text-fg"}`} />
              <span className="truncate text-caption text-fg-3">{s.sub}</span>
            </Link>
          ))}
        </section>

        {n > 0 && (
          <section aria-labelledby="decisions-h" className="flex flex-col gap-3">
            <h2 id="decisions-h" className="m-0 text-title-3 font-semibold text-fg">
              Waiting on you
            </h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {decisions.slice(0, 3).map((d, i) => (
                <article key={i} className="flex flex-col gap-2.5 rounded-card border border-border bg-s1 px-5 py-4 shadow-e1">
                  <div className="flex items-center justify-between gap-2">
                    <Verdict kind={d.kind} label={d.tag} size="sm" />
                    <span className="font-mono text-caption text-fg-3">{d.ref}</span>
                  </div>
                  <h3 className="m-0 text-ui font-semibold text-fg">{d.title}</h3>
                  <p className="m-0 flex-1 text-callout text-fg-2">{d.sub}</p>
                  <ButtonLink href={d.href} variant={i === 0 ? "primary" : "secondary"} size="sm" className="self-start">
                    {d.cta}
                  </ButtonLink>
                </article>
              ))}
            </div>
          </section>
        )}

        <div className="grid items-start gap-4 lg:grid-cols-3">
          <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
            {traveling && traveling.run && (
              <Card>
                <CardHead sub={`${key(traveling.incident.number)} · ${traveling.repo?.name ?? ""}`} aside={<Verdict kind="running" label="Time traveling" size="sm" />}>
                  {traveling.incident.title}
                </CardHead>
                <div className="flex flex-col gap-3 px-5 py-4">
                  <ol className="m-0 flex list-none gap-1.5 p-0" aria-label="Workflow steps">
                    {traveling.run.steps.slice(2, 7).map((st) => (
                      <li key={st.key} className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <span className={`h-1 rounded-full ${st.state === "ok" ? "bg-proven" : st.state === "bad" ? "bg-recur" : st.state === "running" ? "bg-fg-2" : "bg-s3"}`} />
                        <span className={`truncate text-caption ${st.state === "pending" ? "text-fg-3" : "text-fg-2"}`}>
                          {st.label.replace("Run before the fix ×3", "Before ×3").replace("Run on the fix ×3", "Fix ×3").replace("Draft test", "Draft").replace("Admit to memory", "Admit").replace("Open bot pull request", "Bot PR")}
                          <span className="sr-only"> ({st.state})</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                  <ButtonLink href={`/incidents/${traveling.incident.number}/travel`} variant="secondary" size="sm" className="self-start">
                    Watch live
                  </ButtonLink>
                </div>
              </Card>
            )}
            <Card>
              <CardHead aside={<More href="/pulls">All checks</More>}>Recent pull request checks</CardHead>
              {checks.slice(0, 5).map((c) => (
                <CheckRow key={c.check.id} {...c} />
              ))}
              {checks.length === 0 && <p className="m-0 px-5 py-8 text-center text-callout text-fg-3">No pull requests checked yet.</p>}
            </Card>
            <Card>
              <CardHead aside={<More href="/incidents">All incidents</More>}>Recent incidents</CardHead>
              <ul className="m-0 list-none p-0">
                {rows.slice(0, 5).map(({ incident: i, repo }) => (
                  <li key={i.id} className="border-b border-border-soft last:border-b-0">
                    <Link href={`/incidents/${i.number}`} className="flex items-center gap-3 px-5 py-3 no-underline transition-colors duration-150 hover:bg-s2/60">
                      <span className="w-14 shrink-0 font-mono text-callout text-fg-3">{key(i.number)}</span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-ui font-medium text-fg">{i.title}</span>
                        <span className="truncate text-caption text-fg-3">
                          {repo?.name ?? "no repository"} · {timeAgo(i.updatedAt)}
                        </span>
                      </span>
                      <StatusPill status={i.status} />
                    </Link>
                  </li>
                ))}
              </ul>
              {rows.length === 0 && (
                <div className="p-4">
                  <EmptyState title="No incidents yet" action={<ButtonLink href="/incidents/new" size="sm">Bring one in</ButtonLink>}>
                    Import a closed GitHub issue or paste a postmortem.
                  </EmptyState>
                </div>
              )}
            </Card>
          </div>

          <aside className="flex min-w-0 flex-col gap-4" aria-label="Memory health and fault lines">
            <Card>
              <CardHead sub="Memory tests that need a look" aside={unwell.length > 0 ? <Badge>{unwellCount}</Badge> : undefined}>
                Failing and flaky
              </CardHead>
              {unwell.length === 0 ? (
                <div className="flex items-center gap-2.5 px-5 py-4 text-callout text-fg-2">
                  <Verdict kind="healthy" size="sm" />
                  Every memory test passed on main last night.
                </div>
              ) : (
                <ul className="m-0 list-none p-0">
                  {unwell.slice(0, 5).map((m) => (
                    <li key={m.test.id} className="border-b border-border-soft last:border-b-0">
                      <Link href={`/memory?test=${m.test.id}`} className="flex items-center gap-3 px-5 py-2.5 no-underline hover:bg-s2/60">
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-callout font-medium text-fg">{m.incident.title}</span>
                          <span className="truncate font-mono text-caption text-fg-3">{m.test.fn}</span>
                        </span>
                        <Verdict kind={m.test.health === "failing" ? "failing" : m.test.health === "flaky" ? "flaky" : "skipped"} label={m.test.health === "healthy" ? "Quarantined" : undefined} size="sm" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card>
              <CardHead sub="Files where incidents keep starting">Fault lines</CardHead>
              <ul className="m-0 list-none p-0">
                {faults.slice(0, 5).map((f) => (
                  <li key={f.file} className="flex flex-col gap-1.5 border-b border-border-soft px-5 py-2.5">
                    <div className="flex justify-between gap-3 text-callout">
                      <span className="truncate font-mono text-fg">{f.file}</span>
                      <span className="shrink-0 tabular-nums text-fg-3">
                        {f.count} {f.count === 1 ? "incident" : "incidents"}
                      </span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-s2" aria-hidden="true">
                      <div className={`h-full rounded-full ${f.count >= 3 ? "bg-recur" : "bg-fg-3"}`} style={{ width: `${(f.count / maxFault) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
              {faults.length === 0 && <p className="m-0 px-5 py-4 text-callout text-fg-3">No fault lines yet.</p>}
              <p className="m-0 px-5 py-3 text-caption text-fg-3">A pull request touching these files always runs their memory tests.</p>
            </Card>
            <Card>
              <CardHead>Activity</CardHead>
              <ol className="m-0 list-none px-5 pb-1 pt-4">
                {activity.map((a, i) => (
                  <li key={a.id} className="flex gap-3">
                    <span className="flex shrink-0 flex-col items-center" aria-hidden="true">
                      <span className={`mt-1.5 h-2 w-2 rounded-full ${TONE_DOT[a.tone] ?? TONE_DOT.neutral}`} />
                      {i < activity.length - 1 && <span className="mt-1 w-px flex-1 bg-border" />}
                    </span>
                    <span className="flex min-w-0 flex-col pb-3.5">
                      <span className="text-callout font-medium text-fg">{a.title}</span>
                      <span className="text-caption text-fg-3">{timeAgo(a.createdAt)}</span>
                    </span>
                  </li>
                ))}
              </ol>
              {activity.length === 0 && <p className="m-0 px-5 pb-4 text-callout text-fg-3">Nothing has happened yet.</p>}
            </Card>
          </aside>
        </div>
      </Main>
    </>
  );
}
