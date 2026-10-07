import type { Metadata } from "next";
import Link from "next/link";
import { currentScope } from "@/lib/auth/scope";
import { TopBar, Main, PageTitle } from "@/components/app/TopBar";
import { Card, CardHead } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { ButtonLink } from "@/components/ui/Button";
import { CheckRow, DOT } from "@/components/app/bits";
import { incidentKey } from "@/lib/domain/ids";
import { timeAgo, word } from "@/lib/format";

export const metadata: Metadata = { title: "Overview" };

export default async function Overview() {
  const { scope } = await currentScope();
  const [ws, rows, memory, checks, faults, activity, repos] = await Promise.all([
    scope.workspace(),
    scope.incidentRows({}),
    scope.memory(),
    scope.checks(),
    scope.faultLines(),
    scope.activity(5),
    scope.repos(),
  ]);
  const prefix = ws?.incidentPrefix ?? "INC";
  const key = (n: number) => incidentKey(prefix, n);

  const decisions = [
    ...memory.filter((m) => m.test.botPrState === "open").map((m) => ({
      tag: <Pill tone="pass">Merge proven test</Pill>, ref: `PR #${m.test.botPr}`,
      title: `${key(m.incident.number)} is proven. Merge the test that guards it.`,
      sub: `aftershock opened a PR adding ${m.test.path}`, cta: "Review the incident", href: `/incidents/${m.incident.number}`, primary: true,
    })),
    ...rows.filter((r) => r.incident.status === "unproven").map((r) => ({
      tag: <Pill tone="dashed">Unproven</Pill>, ref: key(r.incident.number), title: r.incident.title,
      sub: r.incident.statusReason ?? "The drafts could not reproduce it.", cta: "Open the run", href: `/incidents/${r.incident.number}/travel`, primary: false,
    })),
    ...rows.filter((r) => r.incident.status === "awaiting_fix").map((r) => ({
      tag: <Pill tone="warn">Awaiting fix</Pill>, ref: key(r.incident.number), title: r.incident.title,
      sub: `Opened from ${r.incident.source === "sentry" ? "Sentry" : r.incident.source === "pagerduty" ? "PagerDuty" : "a report"} ${timeAgo(r.incident.createdAt).toLowerCase()}. Link the fix when it lands.`,
      cta: "Link a fix", href: `/incidents/${r.incident.number}`, primary: false,
    })),
  ];
  const week = Date.now() - 7 * 86_400_000;
  const recentChecks = checks.filter((c) => c.check.createdAt.getTime() > week);
  const recur = checks.filter((c) => c.check.verdict === "recur");
  const awaiting = rows.filter((r) => r.incident.status === "awaiting_fix");
  const traveling = rows.find((r) => r.incident.status === "traveling");
  const maxFault = Math.max(1, ...faults.map((f) => f.count));
  const n = decisions.length;

  const stats = [
    { k: "Proven tests in memory", v: memory.length, sub: `across ${new Set(memory.map((m) => m.repo.id)).size} repositories`, href: "/memory", fail: false },
    { k: "Pull requests checked", v: recentChecks.length, sub: "last 7 days", href: "/pulls", fail: false },
    { k: "Recurrences blocked", v: recur.length, sub: recur[0] ? `PR #${recur[0].check.prNumber}` : "none yet", href: recur[0] ? `/pulls/${recur[0].check.prNumber}` : "/pulls", fail: recur.length > 0 },
    { k: "Awaiting fix", v: awaiting.length, sub: "from alerts and reports", href: "/incidents?status=awaiting_fix", fail: false },
  ];

  return (
    <>
      <TopBar title="Overview">
        <ButtonLink href="/incidents/new" className="min-h-10">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
          New incident
        </ButtonLink>
      </TopBar>
      <Main>
        <PageTitle
          eyebrow={`${new Date().toLocaleDateString("en-US", { weekday: "long" })} · ${repos.length} repositories`}
          title={n === 0 ? "Nothing is waiting on you." : `${word(n)} ${n === 1 ? "decision is" : "decisions are"} waiting on you.`}
        />
        {n > 0 && (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] gap-3">
            {decisions.slice(0, 3).map((d, i) => (
              <article key={i} className="flex flex-col gap-3 rounded-[14px] border border-line bg-card px-5 py-[18px] shadow-[0_1px_2px_rgba(14,20,27,0.04)]">
                <div className="flex items-center justify-between gap-2">{d.tag}<span className="font-mono text-xs text-muted-2">{d.ref}</span></div>
                <span className="text-[15px] font-semibold tracking-[-0.01em]">{d.title}</span>
                <span className="flex-1 text-[13px] text-muted">{d.sub}</span>
                <ButtonLink href={d.href} variant={d.primary ? "primary" : "secondary"} className="min-h-10 self-start text-[13px]">{d.cta}</ButtonLink>
              </article>
            ))}
          </div>
        )}

        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] overflow-hidden rounded-[14px] border border-line bg-card">
          {stats.map((s) => (
            <Link key={s.k} href={s.href} className="flex flex-col gap-1 border-r border-line-soft px-[22px] py-[18px] text-inherit no-underline hover:bg-[#FAFAF8]">
              <span className="text-[12.5px] text-muted">{s.k}</span>
              <span className={`font-mono text-[28px] font-semibold tracking-[-0.02em] ${s.fail ? "text-fail" : ""}`}>{s.v}</span>
              <span className="text-xs text-muted-2">{s.sub}</span>
            </Link>
          ))}
        </div>

        <div className="flex flex-wrap items-start gap-4">
          <div className="flex min-w-0 flex-[1.7_1_560px] flex-col gap-4">
            <Card>
              <CardHead aside={<Link href="/pulls" className="inline-flex min-h-10 items-center text-[13px] text-pass no-underline">All checks →</Link>}>Recent pull request checks</CardHead>
              {checks.slice(0, 5).map((c) => <CheckRow key={c.check.id} {...c} />)}
              {checks.length === 0 && <p className="m-0 px-5 py-8 text-center text-muted">No pull requests checked yet.</p>}
            </Card>
            {traveling && traveling.run && (
              <Card dark>
                <CardHead dark aside={<span className="font-mono text-xs text-[#7D8896]">{key(traveling.incident.number)} · {traveling.repo?.name}</span>}>Time travel in progress</CardHead>
                <div className="flex flex-col gap-3.5 px-5 py-[18px]">
                  <span className="font-semibold">{traveling.incident.title}</span>
                  <div className="flex gap-1.5">
                    {traveling.run.steps.slice(2, 7).map((st) => (
                      <span key={st.key} className="flex flex-1 flex-col gap-1.5">
                        <span className={`h-1.5 rounded-[3px] ${st.state === "ok" ? "bg-pass-dark" : st.state === "running" ? "bg-on-dark" : "bg-ink-line"}`} />
                        <span className={`truncate font-mono text-[11.5px] ${st.state === "pending" ? "text-[#56616E]" : "text-[#C9D1DA]"}`}>{st.label.replace("Run before the fix ×3", "Before ×3").replace("Run on the fix ×3", "Fix ×3").replace("Draft test", "Draft").replace("Admit to memory", "Admit").replace("Open bot pull request", "Bot PR")}</span>
                      </span>
                    ))}
                  </div>
                  <ButtonLink href={`/incidents/${traveling.incident.number}/travel`} variant="darkOutline" className="min-h-10 self-start text-[13px]">Watch live</ButtonLink>
                </div>
              </Card>
            )}
          </div>
          <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-4">
            <Card>
              <CardHead sub="Files where incidents keep starting">Fault lines</CardHead>
              {faults.slice(0, 5).map((f) => (
                <div key={f.file} className="flex flex-col gap-1.5 border-b border-line-soft px-5 py-3">
                  <div className="flex justify-between gap-2.5 text-[12.5px]"><span className="truncate font-mono">{f.file}</span><span className="shrink-0 font-mono text-muted">{f.count} inc</span></div>
                  <div className="h-1.5 overflow-hidden rounded-[3px] bg-line-soft"><div className={`h-full rounded-[3px] ${f.count >= 3 ? "bg-fail" : f.count === 2 ? "bg-[#E8A27A]" : "bg-field"}`} style={{ width: `${(f.count / maxFault) * 100}%` }} /></div>
                </div>
              ))}
              <div className="px-5 py-3 text-[12.5px] text-muted">A pull request touching these files always runs their memory tests.</div>
            </Card>
            <Card>
              <CardHead>Activity</CardHead>
              <ol className="m-0 list-none px-5 pb-1 pt-4">
                {activity.map((a) => (
                  <li key={a.id} className="flex gap-3">
                    <span className="flex shrink-0 flex-col items-center"><span className={`mt-[5px] h-2.5 w-2.5 rounded-full ${DOT[a.tone]}`} /><span className="min-h-3.5 w-0.5 flex-1 bg-[#EDEEE9]" /></span>
                    <span className="flex min-w-0 flex-col pb-3.5"><span className="text-[13.5px] font-semibold">{a.title}</span><span className="text-xs text-muted-2">{timeAgo(a.createdAt)}</span></span>
                  </li>
                ))}
              </ol>
            </Card>
          </aside>
        </div>
      </Main>
    </>
  );
}
