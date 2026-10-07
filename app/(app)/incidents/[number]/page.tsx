import Link from "next/link";
import { notFound } from "next/navigation";
import { currentScope } from "@/lib/auth/scope";
import { TopBar, Main } from "@/components/app/TopBar";
import { Card, CardHead } from "@/components/ui/Card";
import { Pill, StatusPill, VerdictPill } from "@/components/ui/Pill";
import { ButtonLink } from "@/components/ui/Button";
import { Strip, toCells } from "@/components/ui/Strip";
import { DOT } from "@/components/app/bits";
import { SOURCES } from "@/components/app/sources";
import { AutoRefresh } from "@/components/app/AutoRefresh";
import { incidentKey } from "@/lib/domain/ids";
import { stamp } from "@/lib/format";
import { addNote, linkFix } from "../../actions";

export default async function IncidentPage({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<{ error?: string }> }) {
  const { number } = await params;
  const { error } = await searchParams;
  const { scope } = await currentScope();
  const inc = await scope.getIncident(Number(number));
  if (!inc) notFound();
  const [ws, repo, runs, mem, checks, notes, trail] = await Promise.all([
    scope.workspace(), inc.repoId ? scope.repo(inc.repoId) : null, scope.runs(inc.id), scope.memoryForIncident(inc.id), scope.checksForIncident(inc.id), scope.notes(inc.id), scope.trail(inc.id),
  ]);
  const key = incidentKey(ws?.incidentPrefix ?? "INC", inc.number);
  const proven = runs.find((r) => r.status === "proven");
  const latest = runs.at(-1);
  const epic = inc.epicenter && "sha" in inc.epicenter ? inc.epicenter : null;

  return (
    <>
      <TopBar crumbs={[{ label: "Incidents", href: "/incidents" }, { label: key }]} />
      <AutoRefresh active={inc.status === "traveling"} />
      <Main>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-[1_1_520px] flex-col gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={inc.status} />
              {repo && <Pill tone="neutral" mono>{repo.name}</Pill>}
              <Pill tone={inc.severity === "SEV-1" ? "fail" : "neutral"} mono>{inc.severity}</Pill>
              <span className="text-[12.5px] text-muted">From {SOURCES[inc.source][0].toLowerCase()}{inc.sourceRef ? ` ${inc.sourceRef}` : ""} · {stamp(inc.createdAt)}</span>
            </div>
            <h1 className="m-0 text-[32px] font-semibold leading-[1.15] tracking-[-0.025em] max-sm:text-[26px]">{inc.title}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {runs.length > 0 && <ButtonLink href={`/incidents/${inc.number}/travel`} variant="secondary">View time travel</ButtonLink>}
            {mem?.botPr && <a href={repo ? `https://github.com/${repo.fullName}/pull/${mem.botPr}` : "#"} className="inline-flex min-h-[42px] items-center rounded-[9px] bg-ink px-3.5 text-[13.5px] font-semibold text-white no-underline">{mem.botPrState === "open" ? `Review bot PR #${mem.botPr}` : `Bot PR #${mem.botPr} · ${mem.botPrState}`}</a>}
          </div>
        </div>

        {inc.statusReason && (inc.status === "awaiting_fix" || inc.status === "unproven" || inc.status === "rejected") && (
          <p className="m-0 rounded-xl border border-line bg-white px-5 py-3.5 text-body">{inc.statusReason}</p>
        )}

        <div className="flex flex-wrap items-start gap-4">
          <div className="flex min-w-0 flex-[1.7_1_560px] flex-col gap-4">
            <Card>
              <CardHead>What happened</CardHead>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))]">
                {[["TRIGGER", inc.trigger, "text-muted-2"], ["OBSERVED", inc.observed, "text-fail"], ["EXPECTED", inc.expected, "text-pass"]].map(([k, v, c]) => (
                  <div key={k} className="flex flex-col gap-1.5 border-r border-line-soft px-[22px] py-5">
                    <span className={`font-mono text-[11.5px] tracking-[0.04em] ${c}`}>{k}</span>
                    <span>{v || <span className="text-muted">Not recorded</span>}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <CardHead aside={inc.fixPr ? <span className="text-[12.5px] text-muted">PR #{inc.fixPr}</span> : null}>The fix</CardHead>
              {inc.fixSha || inc.fixPr ? (
                <div className="flex flex-wrap">
                  <div className="flex flex-[1_1_240px] items-center gap-3.5 border-r border-line-soft px-[22px] py-[18px]"><span className="h-3 w-3 shrink-0 rounded-full border-2 border-fail" /><span className="flex flex-col"><span className="font-mono font-semibold">{inc.parentSha ?? "resolved at run time"}</span><span className="text-[12.5px] text-muted">before the fix · parent</span></span></div>
                  <div className="flex flex-[1_1_240px] items-center gap-3.5 border-r border-line-soft px-[22px] py-[18px]"><span className="h-3 w-3 shrink-0 rounded-full bg-pass" /><span className="flex flex-col"><span className="font-mono font-semibold">{inc.fixSha ?? `PR #${inc.fixPr}`}</span><span className="text-[12.5px] text-muted">{inc.fixTitle ?? "the fix"}</span></span></div>
                  {epic && <div className="flex flex-[1_1_220px] flex-col justify-center px-[22px] py-[18px]"><span className="font-mono text-[11.5px] tracking-[0.04em] text-fail">EPICENTER</span><span className="text-[13px]">Introduced in <span className="font-mono font-semibold">{epic.sha}</span>{epic.prNumber ? ` · PR #${epic.prNumber}` : ""}</span><span className="text-xs text-muted">{epic.title ?? ""} · found in {epic.testedCommits} runs</span></div>}
                </div>
              ) : (
                <form action={linkFix} className="flex flex-wrap items-end gap-3 px-[22px] py-5">
                  <input type="hidden" name="incidentId" value={inc.id} />
                  <label className="flex flex-[1_1_280px] flex-col gap-1.5 text-[13px] font-semibold">Fix commit or pull request<input name="fix" required placeholder="SHA, #PR or GitHub URL" className="min-h-[46px] rounded-[9px] border border-field px-3 font-mono text-[13px] font-normal" /></label>
                  <button type="submit" className="min-h-[46px] cursor-pointer rounded-[9px] bg-ink px-4 font-semibold text-white">Link fix and time travel</button>
                  {error === "fix" && <p role="alert" className="m-0 w-full text-[13px] text-fail-deep">Enter a commit SHA, a PR number like #44, or a GitHub URL.</p>}
                </form>
              )}
            </Card>

            {proven && (
              <Card dark>
                <CardHead dark aside={<Pill tone="passDark" mono>PROVEN · attempt {proven.attempt}</Pill>}><span className="font-mono text-[13px]">{proven.testPath}</span></CardHead>
                <div className="flex flex-wrap">
                  <pre className="m-0 min-w-0 flex-[1.5_1_420px] overflow-x-auto px-[22px] py-[18px] font-mono text-[12.5px] leading-[1.75] text-[#C9D1DA]">{proven.testCode}</pre>
                  <div className="flex flex-[1_1_220px] flex-col justify-center gap-3.5 border-l border-[#222C38] px-[22px] py-[18px]">
                    <div className="flex flex-col gap-1.5"><span className="flex justify-between text-xs text-on-dark-muted"><span>Before the fix</span><span className="font-mono text-fail-dark">{proven.beforeResults.filter((r) => r.outcome === "failed").length}/{proven.beforeResults.length} fail</span></span><Strip cells={toCells(proven.beforeResults)} height={14} /></div>
                    <div className="flex flex-col gap-1.5"><span className="flex justify-between text-xs text-on-dark-muted"><span>On the fix</span><span className="font-mono text-pass-dark">{proven.fixResults.filter((r) => r.outcome === "passed").length}/{proven.fixResults.length} pass</span></span><Strip cells={toCells(proven.fixResults)} height={14} /></div>
                    <span className="text-xs text-[#7D8896]">Drafted by {proven.model ?? "the model"} · proven by execution {stamp(proven.finishedAt)}</span>
                  </div>
                </div>
              </Card>
            )}
            {!proven && latest && (
              <Card>
                <CardHead aside={<StatusPill status={inc.status} />}>Time travel</CardHead>
                <div className="flex flex-wrap items-center justify-between gap-3 px-[22px] py-4"><span className="text-body">Attempt {latest.attempt}: {latest.reason ?? "running"}</span><ButtonLink href={`/incidents/${inc.number}/travel`} variant="secondary">Open the run</ButtonLink></div>
              </Card>
            )}

            <Card>
              <CardHead aside={<span className="font-mono text-xs text-muted-2">{checks.length}</span>}>Pull requests this test has guarded</CardHead>
              {checks.map(({ check, result }) => (
                <Link key={check.id} href={`/pulls/${check.prNumber}`} className="flex flex-wrap items-center gap-x-[18px] gap-y-2.5 border-b border-line-soft px-[22px] py-[15px] text-inherit no-underline hover:bg-[#FAFAF8]">
                  <span className="min-w-0 flex-[1_1_240px]"><span className="block font-semibold">#{check.prNumber} {check.title}</span><span className="font-mono text-xs text-muted-2">{check.runner} · {stamp(check.createdAt)}</span></span>
                  <Strip cells={toCells(result.runs, 3)} width={72} />
                  <VerdictPill verdict={result.verdict} />
                </Link>
              ))}
              {checks.length === 0 && <p className="m-0 px-[22px] py-6 text-muted">{proven ? "No pull request has touched this code yet." : "Pull requests are guarded once the test is proven."}</p>}
            </Card>

            <Card>
              <CardHead>Notes</CardHead>
              <div className="flex flex-col gap-3.5 px-[22px] py-[18px]">
                {notes.map(({ note, user }) => (
                  <div key={note.id} className="flex gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-tint text-xs font-semibold">{(user.name ?? user.login)[0].toUpperCase()}</span>
                    <div className="flex flex-col gap-0.5"><span className="text-[12.5px] text-muted"><span className="font-semibold text-ink">{user.name ?? user.login}</span> · {stamp(note.createdAt)}</span><span>{note.text}</span></div>
                  </div>
                ))}
                <form action={addNote} className="flex flex-col gap-2">
                  <input type="hidden" name="incidentId" value={inc.id} />
                  <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Add a note<textarea name="text" rows={2} placeholder="Context for the next person who sees this test fail" className="resize-y rounded-[9px] border border-line-strong px-3 py-2.5 font-normal" /></label>
                  <button type="submit" className="min-h-10 cursor-pointer self-end rounded-[9px] border border-line-strong bg-white px-4 text-[13px] font-semibold">Add note</button>
                </form>
              </div>
            </Card>
          </div>

          <aside className="min-w-0 flex-[1_1_320px] overflow-hidden rounded-[14px] border border-line bg-card shadow-[0_1px_2px_rgba(14,20,27,0.04)]">
            <CardHead>Trail</CardHead>
            <ol className="m-0 list-none px-[22px] pb-2 pt-5">
              {trail.map((t, i) => (
                <li key={t.id} className="flex gap-3.5">
                  <span className="flex shrink-0 flex-col items-center"><span className={`mt-1 h-3 w-3 rounded-full ${DOT[t.tone]}`} /><span className={`min-h-[18px] w-0.5 flex-1 ${i === trail.length - 1 ? "bg-transparent" : "bg-line"}`} /></span>
                  <span className="flex min-w-0 flex-col gap-0.5 pb-5"><span className="font-semibold">{t.title}</span><span className="text-[12.5px] text-muted">{t.detail}</span><span className="font-mono text-[11.5px] text-muted-2">{stamp(t.createdAt)}</span></span>
                </li>
              ))}
              {trail.length === 0 && <li className="pb-5 text-muted">Nothing has happened yet.</li>}
            </ol>
          </aside>
        </div>
      </Main>
    </>
  );
}
