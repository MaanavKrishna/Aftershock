import Link from "next/link";
import { notFound } from "next/navigation";
import { currentScope } from "@/lib/auth/scope";
import { TopBar, Main } from "@/components/app/TopBar";
import { Card, CardHead } from "@/components/ui/Card";
import { AutoRefresh } from "@/components/app/AutoRefresh";
import { incidentKey } from "@/lib/domain/ids";
import { duration, stamp } from "@/lib/format";
import { retryTimeTravel } from "../../../actions";
import type { RunResult } from "@/lib/domain/verdict";

const VERDICT = {
  proven: ["PROVEN", "bg-pass-dark text-ink"],
  rejected: ["REJECTED", "bg-on-dark text-ink"],
  unproven: ["UNPROVEN", "border border-dashed border-on-dark-muted text-on-dark"],
  running: ["RUNNING", "bg-on-dark text-ink"],
} as const;

function Lane({ sha, name, must, runs, detail }: { sha: string; name: string; must: "fail" | "pass"; runs: RunResult[]; detail: string }) {
  return (
    <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-3.5 rounded-xl border border-ink-line bg-ink-2 p-[18px]">
      <div className="flex flex-wrap justify-between gap-2.5">
        <span className="flex flex-col"><span className="font-mono font-semibold text-white">{sha}</span><span className="text-[12.5px] text-on-dark-muted">{name}</span></span>
        <span className="flex flex-col items-end"><span className="text-xs text-[#7D8896]">must</span><span className={`font-semibold ${must === "fail" ? "text-fail-dark" : "text-pass-dark"}`}>{must}</span></span>
      </div>
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => {
          const r = runs[i];
          const cls = !r ? "border border-dashed border-ink-line text-[#56616E]" : r.outcome === "failed" ? "border-[1.5px] border-fail-dark text-fail-dark" : r.outcome === "passed" ? "bg-pass text-white" : "border-[1.5px] border-dashed border-on-dark-muted text-on-dark-muted";
          return (
            <span key={i} className={`flex flex-1 flex-col gap-0.5 rounded-lg px-3 py-2.5 ${cls}`}>
              <span className="font-mono text-[11.5px]">run {i + 1}</span>
              <span className="text-[13px] font-semibold">{r ? (r.outcome === "error" ? "error" : r.outcome) : "pending"}</span>
            </span>
          );
        })}
      </div>
      <span className="font-mono text-xs text-[#8792A0]">{detail}</span>
    </div>
  );
}

const STEP_DOT = { ok: "bg-pass", bad: "bg-fail", skip: "border-2 border-field", running: "bg-[#9AA1A9] animate-pulse", pending: "border-2 border-line" } as const;

export default async function TravelPage({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<{ attempt?: string }> }) {
  const { number } = await params;
  const { attempt } = await searchParams;
  const { scope } = await currentScope();
  const inc = await scope.getIncident(Number(number));
  if (!inc) notFound();
  const [ws, repo, runs] = await Promise.all([scope.workspace(), inc.repoId ? scope.repo(inc.repoId) : null, scope.runs(inc.id)]);
  const key = incidentKey(ws?.incidentPrefix ?? "INC", inc.number);
  const run = runs.find((r) => String(r.attempt) === attempt) ?? runs.at(-1);

  if (!run) {
    return (
      <>
        <TopBar crumbs={[{ label: "Incidents", href: "/incidents" }, { label: key, href: `/incidents/${inc.number}` }, { label: "Time travel" }]} />
        <Main>
          <h1 className="m-0 text-[30px] font-semibold tracking-[-0.025em]">No time travel has run for {key} yet.</h1>
          <p className="m-0 text-muted">{inc.statusReason ?? "Link the fix commit on the incident page to start one."}</p>
        </Main>
      </>
    );
  }

  const proven = run.status === "proven";
  const [label, tagCls] = VERDICT[run.status];
  const headline =
    run.status === "proven" ? `The test reproduces ${key} and the fix stops it.`
    : run.status === "rejected" ? "This draft passed before the fix, so it proves nothing."
    : run.status === "running" ? `Time traveling through ${repo?.name ?? "the repository"}…`
    : "This draft could not be proven.";
  const parent = inc.parentSha ?? "parent";
  const fix = inc.fixSha ?? (inc.fixPr ? `PR #${inc.fixPr}` : "fix");
  const failedBefore = run.beforeResults.filter((r) => r.outcome === "failed").length;

  return (
    <>
      <AutoRefresh active={run.status === "running"} />
      <TopBar crumbs={[{ label: "Incidents", href: "/incidents" }, { label: key, href: `/incidents/${inc.number}` }, { label: "Time travel" }]}>
        <a href={`/api/v1/runs/${run.id}/evidence`} className="inline-flex min-h-[38px] items-center rounded-lg border border-line-strong bg-white px-3 text-[13px] font-semibold text-ink no-underline">Download evidence.json</a>
      </TopBar>
      <Main>
        <section className="overflow-hidden rounded-2xl bg-ink text-on-dark">
          <div className="flex flex-wrap items-end justify-between gap-[18px] px-7 pb-2 pt-[26px]">
            <div className="flex flex-[1_1_460px] flex-col gap-2.5">
              <div className="flex flex-wrap items-center gap-2"><span className={`rounded-md px-2.5 py-1 font-mono text-xs font-semibold ${tagCls}`}>{label}</span><span className="text-[12.5px] text-on-dark-muted">Attempt {run.attempt} of {runs.length} · {stamp(run.createdAt)}{run.wallMs ? ` · ${duration(run.wallMs)}` : ""}</span></div>
              <h1 className="m-0 text-[clamp(26px,2.6vw,34px)] font-semibold leading-[1.15] tracking-[-0.025em] text-white">{headline}</h1>
            </div>
            {runs.length > 1 && (
              <nav aria-label="Attempt" className="flex flex-wrap rounded-[9px] border border-ink-line bg-ink-2 p-[3px]">
                {runs.map((r) => (
                  <Link key={r.id} href={`?attempt=${r.attempt}`} aria-current={r.id === run.id ? "page" : undefined} className={`inline-flex min-h-9 items-center rounded-[7px] px-3.5 text-[13px] font-semibold no-underline ${r.id === run.id ? "bg-on-dark text-ink" : "text-on-dark-muted"}`}>Attempt {r.attempt} · {r.status}</Link>
                ))}
              </nav>
            )}
          </div>
          <div className="flex flex-wrap items-stretch gap-3.5 px-7 pb-7 pt-[22px]">
            <Lane sha={parent} name="Before the fix" must="fail" runs={run.beforeResults} detail={run.beforeResults.length === 0 ? "not run yet" : failedBefore === run.beforeResults.length ? "reproduced the incident" : run.beforeResults[0]?.message ?? "did not reproduce"} />
            <Lane sha={fix} name="On the fix" must="pass" runs={run.fixResults} detail={run.fixResults.length === 0 ? (run.status === "rejected" ? "skipped: nothing to prove" : "not run yet") : run.fixResults.every((r) => r.outcome === "passed") ? "the fix stops it" : run.fixResults.find((r) => r.message)?.message ?? "did not pass"} />
          </div>
        </section>

        {run.reason && run.status !== "proven" && <p className="m-0 rounded-xl border border-line bg-white px-5 py-3.5 text-body">{run.reason}</p>}

        <div className="flex flex-wrap items-start gap-4">
          <div className="flex min-w-0 flex-[1.7_1_560px] flex-col gap-4">
            {run.steps.length > 0 && (
              <Card>
                <CardHead aside={<span className="font-mono text-xs text-muted-2">durable · resumes after failures</span>}>Workflow</CardHead>
                {run.steps.map((st) => (
                  <div key={st.key} className="flex items-center gap-3.5 border-b border-line-soft px-[22px] py-3">
                    <span className={`h-3 w-3 shrink-0 rounded-full ${STEP_DOT[st.state]}`} />
                    <span className="flex min-w-0 flex-1 flex-col"><span className="font-semibold">{st.label}</span><span className="text-[12.5px] text-muted">{st.detail}</span></span>
                    <span className="font-mono text-xs text-muted-2">{st.ms != null ? duration(st.ms) : "—"}</span>
                  </div>
                ))}
              </Card>
            )}
            {run.testCode && (
              <Card dark>
                <CardHead dark aside={<span className={`font-mono text-xs ${proven ? "text-pass-dark" : "text-on-dark-muted"}`}>{proven ? "admitted" : `${run.status} draft`}</span>}><span className="font-mono text-[12.5px]">{run.testPath}</span></CardHead>
                <pre className="m-0 overflow-x-auto px-[22px] py-[18px] font-mono text-[12.5px] leading-[1.75] text-[#C9D1DA]">{run.testCode}</pre>
                {(run.feedback || proven) && <div className="border-t border-[#222C38] px-[22px] py-3.5 text-[13px] text-on-dark-muted">{proven ? "Why it is trusted: it fails on the commit before the fix and passes on the fix, on every run." : `Fed into the next draft: ${run.feedback}`}</div>}
              </Card>
            )}
            {run.log && (
              <Card dark>
                <CardHead dark aside={<span className="font-mono text-xs text-[#7D8896]">trimmed to the failure</span>}>Sandbox output</CardHead>
                <pre className="m-0 overflow-x-auto px-[22px] py-4 font-mono text-xs leading-[1.75] text-on-dark-muted">{run.log}</pre>
              </Card>
            )}
          </div>
          <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
            {run.inputs.length > 0 && (
              <Card>
                <CardHead sub="Passed as fenced data, never instructions">What the model read</CardHead>
                {run.inputs.map((i) => <div key={i.name} className="flex justify-between gap-3 border-b border-line-soft px-5 py-2.5 text-[13px]"><span className="truncate font-mono text-[12.5px]">{i.name}</span><span className="shrink-0 text-muted">{i.note}</span></div>)}
              </Card>
            )}
            <Card>
              <CardHead>Environment</CardHead>
              {[["Runner", run.runner === "docker" ? "Local Docker" : run.runner === "sandbox" ? "Aftershock sandbox" : run.runner], ["Framework", repo?.framework ?? "—"], ["Install", repo?.installCmd ?? "—"], ["Network after install", "blocked"], ["Secrets", "none"], ["Wall time", duration(run.wallMs || null)], ["Active CPU", duration(run.cpuMs || null)], ["Model", run.model ?? "—"]].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b border-line-soft px-5 py-2.5 text-[13px]"><span className="text-muted">{k}</span><span className="text-right font-mono text-[12.5px]">{v}</span></div>
              ))}
            </Card>
            <Card>
              <CardHead>Reproduce locally</CardHead>
              <pre className="m-0 overflow-x-auto bg-[#FAFAF8] px-5 py-3.5 font-mono text-xs">npx aftershock verify {key} --local</pre>
            </Card>
            {run.status !== "running" && !proven && (
              <form action={retryTimeTravel} className="flex flex-col gap-3 rounded-[14px] bg-ink p-5 text-on-dark">
                <input type="hidden" name="incidentId" value={inc.id} />
                <span className="font-semibold">Not convinced?</span>
                <span className="text-[13px] text-on-dark-muted">Give the model a hint. The new draft faces the same time travel.</span>
                <label className="flex flex-col gap-1.5 text-[12.5px] text-[#C9D1DA]">Hint<textarea name="hint" rows={2} placeholder="e.g. the bug only shows when the first response is lost" className="resize-y rounded-[9px] border border-[#344150] bg-ink-2 px-3 py-2.5 text-on-dark" /></label>
                <button type="submit" className="min-h-11 cursor-pointer rounded-[9px] bg-paper font-semibold text-ink">Redraft and re-run</button>
              </form>
            )}
          </aside>
        </div>
      </Main>
    </>
  );
}
