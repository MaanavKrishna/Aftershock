import Link from "next/link";
import { notFound } from "next/navigation";
import { currentScope } from "@/lib/auth/scope";
import { TopBar, Main } from "@/components/app/TopBar";
import { Card, CardHead } from "@/components/ui/Card";
import { Pill, VerdictPill } from "@/components/ui/Pill";
import { Strip, toCells } from "@/components/ui/Strip";
import { AutoRefresh } from "@/components/app/AutoRefresh";
import { incidentKey } from "@/lib/domain/ids";
import { duration, stamp } from "@/lib/format";
import { requestSuggestedFix } from "../../actions";
import { OverrideForm } from "./OverrideForm";
import { can } from "@/lib/auth/roles";

const HEAD = {
  recur: ["RECUR", "bg-fail text-white", "bg-fail"],
  safe: ["SAFE", "bg-pass text-white", "bg-pass"],
  inconclusive: ["INCONCLUSIVE", "border border-dashed border-muted-2 text-body", "bg-[#9AA1A9]"],
  skipped: ["SKIPPED", "bg-neutral-tint text-body", "bg-line"],
  running: ["RUNNING", "bg-ink text-white", "bg-ink"],
} as const;

export default async function CheckPage({ params, searchParams }: { params: Promise<{ pr: string }>; searchParams: Promise<{ repo?: string; inc?: string }> }) {
  const { pr } = await params;
  const sp = await searchParams;
  const { scope, session } = await currentScope();
  const [ws, data, me] = await Promise.all([scope.workspace(), scope.check(Number(pr), sp.repo), scope.me(session.userId)]);
  const canOverride = can(me?.role, "override");
  if (!data) notFound();
  const { check, repo, results, skips, fix, overrides } = data;
  const prefix = ws?.incidentPrefix ?? "INC";
  const key = (n: number) => incidentKey(prefix, n);
  const verdict = check.verdict ?? "running";
  const [tag, tagCls, bar] = HEAD[verdict];
  const recur = results.filter((r) => r.result.verdict === "recur");
  const sel = results.find((r) => String(r.incident.number) === sp.inc) ?? results[0];
  const headline =
    verdict === "recur" ? `This change would ship ${key(recur[0].incident.number)} again.`
    : verdict === "safe" ? "This change keeps every lesson it touches."
    : verdict === "inconclusive" ? "The results were mixed, so this is not green."
    : verdict === "skipped" ? "No remembered incident is relevant to this change."
    : "Checking this change against memory…";
  const sub =
    verdict === "recur" ? `The proven test for “${recur[0].incident.title}” failed on ${recur[0].result.runs.filter((r) => r.outcome === "failed").length} of ${recur[0].result.runs.length} runs.`
    : verdict === "inconclusive" ? "At least one test passed on some runs and failed on others, or the environment failed. Re-run, or mark the test flaky."
    : `${results.length} relevant test${results.length === 1 ? "" : "s"} ran; ${skips.length} incident${skips.length === 1 ? " was" : "s were"} skipped with reasons.`;
  const diffLines = check.diff ? check.diff.split("\n") : [];
  const counts = { recur: recur.length, safe: results.filter((r) => r.result.verdict === "safe").length, skipped: skips.length };

  return (
    <>
      <AutoRefresh active={check.status !== "done" || fix?.status === "running"} />
      <TopBar crumbs={[{ label: "Pull requests", href: "/pulls" }, { label: `#${check.prNumber}` }]}>
        <a href={`https://github.com/${repo.fullName}/pull/${check.prNumber}`} className="inline-flex min-h-[38px] items-center rounded-lg bg-ink px-3 text-[13px] font-semibold text-white no-underline">Open on GitHub</a>
      </TopBar>
      <Main>
        <section className="overflow-hidden rounded-2xl border border-line bg-card shadow-[0_1px_2px_rgba(14,20,27,0.04)]">
          <div className={`h-1.5 ${bar}`} />
          <div className="flex flex-wrap items-end gap-7 px-7 py-[26px]">
            <div className="flex min-w-0 flex-[1.6_1_460px] flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-md px-2.5 py-1 font-mono text-xs font-semibold ${tagCls}`}>{tag}</span>
                <Pill tone="neutral" mono>{repo.checkMode === "blocking" ? "blocking" : "advisory"}</Pill>
                {check.overridden && <Pill tone="dashed">overridden</Pill>}
                <span className="text-[12.5px] text-muted">{repo.name} · head {check.headSha} · {stamp(check.createdAt)}{check.runner ? ` · ${duration(check.durationMs)} in ${check.runner}` : ""}</span>
              </div>
              <h1 className="m-0 text-[clamp(26px,2.8vw,36px)] font-semibold leading-[1.12] tracking-[-0.03em]">{headline}</h1>
              <p className="m-0 text-[15px] text-body">“{check.title}” · {sub}</p>
            </div>
            <div className="grid flex-[1_1_300px] grid-cols-3 gap-2">
              <div className="rounded-xl bg-fail-tint p-3.5"><div className="text-xs text-fail-ink">Recur</div><div className="font-mono text-[28px] font-semibold text-fail">{counts.recur}</div></div>
              <div className="rounded-xl bg-pass-wash p-3.5"><div className="text-xs text-pass-deep">Safe</div><div className="font-mono text-[28px] font-semibold text-pass">{counts.safe}</div></div>
              <div className="rounded-xl bg-paper p-3.5"><div className="text-xs text-muted">Skipped</div><div className="font-mono text-[28px] font-semibold text-body">{counts.skipped}</div></div>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap items-start gap-5">
          <div className="flex min-w-0 flex-[2_1_640px] flex-col gap-5">
            <Card>
              <CardHead aside={<span className="text-[12.5px] text-muted">Select one to see its trace</span>}>Incidents run on this change</CardHead>
              {results.map(({ result, incident }) => {
                const on = sel?.result.id === result.id;
                return (
                  <Link key={result.id} href={`?${new URLSearchParams({ ...(sp.repo ? { repo: sp.repo } : {}), inc: String(incident.number) })}`} aria-current={on ? "true" : undefined} className={`flex min-h-16 items-center gap-3.5 border-b border-line-soft px-[22px] py-3 text-inherit no-underline ${on ? "bg-pass-wash shadow-[inset_3px_0_0_#0E141B]" : "hover:bg-[#FAFAF8]"}`}>
                    <span className="w-14 shrink-0 font-mono text-[12.5px] text-muted">{key(incident.number)}</span>
                    <span className="flex min-w-0 flex-1 flex-col"><span className="font-semibold">{incident.title}</span><span className="text-xs text-muted-2">{result.why}</span></span>
                    <Strip cells={toCells(result.runs, 3)} width={66} />
                    <VerdictPill verdict={result.verdict} />
                  </Link>
                );
              })}
              {results.length === 0 && <p className="m-0 px-[22px] py-6 text-muted">{check.status === "done" ? "No memory test was relevant to the files this PR changed." : "Selecting relevant tests…"}</p>}
            </Card>

            {sel && (
              <Card dark>
                <CardHead dark aside={<span className="font-mono text-xs text-[#7D8896]">{sel.test.fn}</span>}>Trace · {key(sel.incident.number)} · run 1</CardHead>
                <div className="flex flex-col px-[22px] py-[18px] font-mono text-[12.5px]">
                  {sel.result.trace.map((t, i) => (
                    <div key={i} className="flex gap-3.5 border-b border-dashed border-ink-line py-2.5">
                      <span className="w-5 shrink-0 text-[#56616E]">{String(i + 1).padStart(2, "0")}</span>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5"><span className={t.bad ? "text-fail-dark" : "text-on-dark"}>{t.head}</span><span className="text-[#8792A0]">{t.sub}</span></span>
                    </div>
                  ))}
                </div>
                <div className={`mx-[22px] mb-5 rounded-[9px] px-3.5 py-3 font-mono text-[12.5px] ${sel.result.verdict === "recur" ? "bg-[rgba(251,138,76,0.14)] text-[#FFC9AC]" : "bg-[#16233F] text-[#BFD3FF]"}`}>
                  {sel.result.failureExcerpt ?? `${sel.result.runs.filter((r) => r.outcome === "passed").length} passed · ${sel.result.runs.length}/${sel.result.runs.length} runs`}
                </div>
              </Card>
            )}

            {diffLines.length > 0 && (
              <Card dark>
                <CardHead dark aside={<span className="font-mono text-xs text-fail-dark">{diffLines.filter((l) => l.startsWith("-")).length} lines removed · on a fault line</span>}><span className="font-mono text-xs">{check.changedFiles[0]}</span></CardHead>
                <div className="overflow-x-auto py-3">
                  {diffLines.map((l, i) => (
                    <div key={i} className={`flex whitespace-pre pr-[22px] font-mono text-[12.5px] leading-[1.8] ${l.startsWith("-") ? "bg-[rgba(251,138,76,0.12)] text-[#FFC9AC]" : l.startsWith("+") ? "bg-[rgba(122,167,255,0.12)] text-[#BFD3FF]" : "text-[#8792A0]"}`}>
                      <span className="w-[18px] shrink-0 pl-2 text-center">{l[0] === "-" ? "−" : l[0] === "+" ? "+" : " "}</span><span>{l.slice(1)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {skips.length > 0 && (
              <details className="overflow-hidden rounded-[14px] border border-line bg-card">
                <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between px-[22px] font-semibold">{skips.length} incident{skips.length === 1 ? "" : "s"} skipped, with reasons<span className="font-mono text-muted">+</span></summary>
                {skips.map(({ skip, incident }) => (
                  <div key={skip.id} className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line-soft px-[22px] py-[11px] text-[13px]">
                    <span className="w-14 font-mono text-muted">{key(incident.number)}</span><span className="flex-[1_1_200px] font-semibold">{incident.title}</span><span className="flex-[1_1_220px] text-muted">{skip.reason}</span>
                  </div>
                ))}
              </details>
            )}
          </div>

          <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
            {verdict === "recur" && (
              <section className="flex flex-col gap-3 rounded-[14px] bg-ink p-5 text-on-dark">
                <span className="font-semibold">What next</span>
                <span className="text-[13px] text-on-dark-muted">Ask for a suggested fix. It is checked against {key(recur[0].incident.number)} and every other memory test for this repository before anyone sees it.</span>
                {!fix && (
                  <form action={requestSuggestedFix}>
                    <input type="hidden" name="checkId" value={check.id} />
                    <button type="submit" className="min-h-11 w-full cursor-pointer rounded-[9px] bg-paper font-semibold text-ink">Suggest a fix</button>
                  </form>
                )}
                {fix && (
                  <div className="flex flex-col gap-1.5 rounded-[10px] border border-ink-line bg-ink-2 px-3.5 py-3 text-[12.5px]">
                    <span className={`font-semibold ${fix.status === "passed" ? "text-pass-dark" : fix.status === "failed" ? "text-fail-dark" : "text-on-dark"}`}>
                      {fix.status === "running" ? "Checking the suggested fix…" : fix.status === "passed" ? `Fix passed ${fix.results.length}/${fix.results.length} memory tests` : "The suggested fix did not pass every memory test"}
                    </span>
                    <span className="text-on-dark-muted">{fix.explanation || "Posted as a suggestion on the PR — a human applies it."}</span>
                  </div>
                )}
                {canOverride ? <OverrideForm checkId={check.id} /> : null}
                <span className="text-xs text-[#7D8896]">{canOverride ? "Overrides are recorded on the incident’s trail." : "Only owners and admins can override a check."}</span>
              </section>
            )}
            {overrides.length > 0 && (
              <Card>
                <CardHead>Overrides</CardHead>
                {overrides.map(({ o, user }) => <div key={o.id} className="border-b border-line-soft px-5 py-3 text-[13px]"><span className="font-semibold">{user.name ?? user.login}</span> · {stamp(o.createdAt)}<p className="m-0 mt-1 text-body">{o.reason}</p></div>)}
              </Card>
            )}
            <Card>
              <CardHead>Comment posted on the PR</CardHead>
              <div className="flex flex-col gap-2.5 px-5 py-4 text-[13px]">
                <span className={`self-start rounded-[5px] px-2 py-[3px] font-mono text-[11px] font-semibold ${tagCls}`}>{verdict === "recur" ? `${recur.length} INCIDENT${recur.length === 1 ? "" : "S"} WOULD RECUR` : tag}</span>
                <span className="text-body">{verdict === "recur" ? `This change reopens ${key(recur[0].incident.number)}: ${recur[0].incident.title.toLowerCase()}. ${counts.safe} related incident${counts.safe === 1 ? "" : "s"} passed; ${counts.skipped} skipped.` : sub}</span>
                <span className="font-mono text-xs text-muted">updated in place on every push</span>
              </div>
            </Card>
            <Card>
              <CardHead>Environment</CardHead>
              {[["Runner", check.runner === "sandbox" ? "Aftershock sandbox" : check.runner === "actions" ? "Your GitHub Actions" : "—"], ["Base", `${repo.defaultBranch} @ ${check.baseSha}`], ["Head", check.headSha], ["Framework", repo.framework], ["Runs per test", "3"], ["Model", "triage only"]].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b border-line-soft px-5 py-2.5 text-[13px]"><span className="text-muted">{k}</span><span className="text-right font-mono text-[12.5px]">{v}</span></div>
              ))}
            </Card>
          </aside>
        </div>
      </Main>
    </>
  );
}
