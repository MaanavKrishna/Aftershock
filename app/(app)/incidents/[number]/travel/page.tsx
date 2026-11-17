import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { currentScope } from "@/lib/auth/scope";
import { TopBar, Main } from "@/components/app/TopBar";
import { Card, CardHead, CardBody } from "@/components/ui/Card";
import { Verdict, type VerdictKind } from "@/components/ui/Verdict";
import { Tabs } from "@/components/ui/Tabs";
import { TextArea } from "@/components/ui/Field";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { ButtonLink, buttonClass } from "@/components/ui/Button";
import { Check, Clock, Cross, Dashed, Ring } from "@/components/ui/icons";
import { AutoRefresh } from "@/components/app/AutoRefresh";
import { KeyValue } from "@/components/app/bits";
import { incidentKey } from "@/lib/domain/ids";
import { duration, stamp } from "@/lib/format";
import { retryTimeTravel } from "../../../actions";
import { RunCells } from "@/components/app/RunCells";
import { LogViewer } from "@/components/app/LogViewer";
import type { RunResult } from "@/lib/domain/verdict";
import type { RunStep } from "@/lib/db/schema";

export async function generateMetadata({ params }: { params: Promise<{ number: string }> }): Promise<Metadata> {
  const { number } = await params;
  return { title: `Time travel · incident ${number}` };
}

const KIND: Record<string, VerdictKind> = { proven: "proven", rejected: "rejected", unproven: "unproven", running: "running" };

function Lane({ sha, name, must, runs, detail }: { sha: string; name: string; must: "fail" | "pass"; runs: RunResult[]; detail: string }) {
  const met = runs.length > 0 && runs.every((r) => r.outcome === (must === "fail" ? "failed" : "passed"));
  return (
    <Card as="div" className="flex min-w-0 flex-col">
      <div className="flex items-start justify-between gap-3 px-5 pt-4">
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-callout text-fg-3">{name}</span>
          <span className="truncate font-mono text-title-3 font-medium text-fg">{sha}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-0.5">
          <span className="text-caption text-fg-3">must</span>
          <span className={`text-callout font-semibold ${must === "fail" ? "text-recur" : "text-proven"}`}>{must}</span>
        </span>
      </div>
      <div className="px-5 py-4">
        <RunCells runs={[0, 1, 2].map((i) => runs[i])} />
      </div>
      <p className={`m-0 mt-auto truncate border-t border-border-soft px-5 py-2.5 font-mono text-caption ${met ? (must === "fail" ? "text-recur" : "text-proven") : "text-fg-3"}`}>{detail}</p>
    </Card>
  );
}

const STEP: Record<RunStep["state"], { Icon: typeof Check; cls: string; word: string }> = {
  ok: { Icon: Check, cls: "bg-proven-soft text-proven", word: "done" },
  bad: { Icon: Cross, cls: "bg-recur-soft text-recur", word: "failed" },
  skip: { Icon: Ring, cls: "bg-s2 text-fg-3", word: "skipped" },
  running: { Icon: Clock, cls: "bg-s3 text-fg", word: "running" },
  pending: { Icon: Dashed, cls: "bg-transparent text-fg-3", word: "pending" },
};

export default async function TravelPage({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<{ attempt?: string }> }) {
  const { number } = await params;
  const { attempt } = await searchParams;
  const { scope } = await currentScope();
  const inc = await scope.getIncident(Number(number));
  if (!inc) notFound();
  const [ws, repo, runs] = await Promise.all([scope.workspace(), inc.repoId ? scope.repo(inc.repoId) : null, scope.runs(inc.id)]);
  const key = incidentKey(ws?.incidentPrefix ?? "INC", inc.number);
  const run = runs.find((r) => String(r.attempt) === attempt) ?? runs.at(-1);
  const crumbs = [{ label: "Incidents", href: "/incidents" }, { label: key, href: `/incidents/${inc.number}` }, { label: "Time travel" }];

  if (!run) {
    return (
      <>
        <AutoRefresh active={inc.status === "traveling"} />
        <TopBar crumbs={crumbs} />
        <Main>
          <div className="flex max-w-2xl flex-col items-start gap-3 py-6">
            <Verdict kind={inc.status === "traveling" ? "running" : "unproven"} />
            <h1 className="m-0 text-title-1 font-semibold text-fg">{inc.status === "traveling" ? `Starting time travel for ${key}…` : `No time travel has run for ${key} yet.`}</h1>
            <p className="m-0 text-ui text-fg-2">{inc.status === "traveling" ? "Resolving the fix and drafting a test. This page updates on its own." : (inc.statusReason ?? "Link the fix commit on the incident page to start one.")}</p>
            <ButtonLink href={`/incidents/${inc.number}`} variant="secondary" size="sm">
              Back to the incident
            </ButtonLink>
          </div>
        </Main>
      </>
    );
  }

  const proven = run.status === "proven";
  const headline =
    run.status === "proven"
      ? `The test reproduces ${key} and the fix stops it.`
      : run.status === "rejected"
        ? "This draft passed before the fix, so it proves nothing."
        : run.status === "running"
          ? `Time traveling through ${repo?.name ?? "the repository"}…`
          : "This draft could not be proven.";
  const parent = inc.parentSha?.slice(0, 7) ?? "parent";
  const fix = inc.fixSha?.slice(0, 7) ?? (inc.fixPr ? `PR #${inc.fixPr}` : "fix");
  const failedBefore = run.beforeResults.filter((r) => r.outcome === "failed").length;

  return (
    <>
      {/* A proven run still stores the test and opens the bot PR; keep refreshing until every step settles. */}
      <AutoRefresh active={run.status === "running" || inc.status === "traveling" || (run.status === "proven" && run.steps.some((st) => st.state === "running" || st.state === "pending"))} />
      <TopBar crumbs={crumbs}>
        <a href={`/api/v1/runs/${run.id}/evidence`} className={buttonClass("secondary", "sm", "max-sm:hidden")}>
          Download evidence.json
        </a>
      </TopBar>
      <Main>
        <header className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Verdict kind={KIND[run.status] ?? "unproven"} />
            <span className="text-callout text-fg-3">
              Attempt {run.attempt} of {runs.length} · {stamp(run.createdAt)}
              {run.wallMs ? ` · ${duration(run.wallMs)}` : ""}
            </span>
          </div>
          <h1 className="m-0 max-w-3xl text-title-1 font-semibold text-balance text-fg">{headline}</h1>
        </header>
        {runs.length > 1 && <Tabs label="Attempt" items={runs.map((r) => ({ href: `?attempt=${r.attempt}`, label: `Attempt ${r.attempt} · ${r.status}`, active: r.id === run.id }))} />}

        <section aria-label="The two commits" className="grid gap-3 md:grid-cols-2">
          <Lane
            sha={parent}
            name="Before the fix"
            must="fail"
            runs={run.beforeResults}
            detail={run.beforeResults.length === 0 ? "not run yet" : failedBefore === run.beforeResults.length ? "reproduced the incident" : (run.beforeResults[0]?.message ?? "did not reproduce")}
          />
          <Lane
            sha={fix}
            name="On the fix"
            must="pass"
            runs={run.fixResults}
            detail={run.fixResults.length === 0 ? (run.status === "rejected" ? "skipped: nothing to prove" : "not run yet") : run.fixResults.every((r) => r.outcome === "passed") ? "the fix stops it" : (run.fixResults.find((r) => r.message)?.message ?? "did not pass")}
          />
        </section>

        {run.reason && !proven && <p className="m-0 rounded-card border border-border bg-s1 px-5 py-3.5 text-ui text-fg-2">{run.reason}</p>}

        <div className="grid items-start gap-4 lg:grid-cols-3">
          <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
            {run.steps.length > 0 && (
              <Card>
                <CardHead sub="Durable: it resumes after failures">Workflow</CardHead>
                <ol className="m-0 list-none p-0">
                  {run.steps.map((st) => {
                    const s = STEP[st.state];
                    return (
                      <li key={st.key} className="flex items-center gap-3 border-b border-border-soft px-5 py-2.5 last:border-b-0">
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${s.cls} ${st.state === "pending" ? "border border-dashed border-border-strong" : ""}`}>
                          <s.Icon size={13} />
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className={`text-ui font-medium ${st.state === "pending" ? "text-fg-3" : "text-fg"}`}>
                            {st.label}
                            <span className="sr-only"> ({s.word})</span>
                          </span>
                          {st.detail && <span className="text-caption text-fg-3">{st.detail}</span>}
                        </span>
                        <span className="shrink-0 font-mono text-caption tabular-nums text-fg-3">{st.ms != null ? duration(st.ms) : "—"}</span>
                      </li>
                    );
                  })}
                </ol>
              </Card>
            )}
            {run.testCode && (
              <section aria-labelledby="draft-h" className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 id="draft-h" className="m-0 text-title-3 font-semibold text-fg">
                    {proven ? "The admitted test" : "The draft"}
                  </h2>
                  {proven ? <Verdict kind="proven" label="Admitted" size="sm" /> : <Verdict kind="drafted" label={`${run.status} draft`} size="sm" />}
                </div>
                <CodeBlock code={run.testCode} file={run.testPath ?? undefined} />
                {(run.feedback || proven) && <p className="m-0 text-callout text-fg-2">{proven ? "Why it is trusted: it fails on the commit before the fix and passes on the fix, on every run." : `Fed into the next draft: ${run.feedback}`}</p>}
              </section>
            )}
            {run.log && (
              <Card>
                <CardHead sub="Trimmed to the failure">Sandbox output</CardHead>
                <LogViewer log={run.log} />
              </Card>
            )}
          </div>
          <aside className="flex min-w-0 flex-col gap-4" aria-label="Run details">
            {run.inputs.length > 0 && (
              <Card>
                <CardHead sub="Passed as fenced data, never instructions">What the model read</CardHead>
                <KeyValue rows={run.inputs.map((i) => [i.name, <span key={i.name} className="font-sans text-fg-3">{i.note}</span>])} />
              </Card>
            )}
            <Card>
              <CardHead>Environment</CardHead>
              <KeyValue
                rows={[
                  ["Runner", run.runner === "docker" ? "Local Docker" : run.runner === "sandbox" ? "Aftershock sandbox" : run.runner],
                  ["Framework", repo?.framework ?? "—"],
                  ["Install", repo?.installCmd ?? "—"],
                  ["Network after install", "blocked"],
                  ["Secrets", "none"],
                  ["Wall time", duration(run.wallMs || null)],
                  ["Active CPU", duration(run.cpuMs || null)],
                  ["Model", run.model ?? "—"],
                ]}
              />
            </Card>
            <section aria-labelledby="repro-h" className="flex flex-col gap-2">
              <h2 id="repro-h" className="m-0 text-ui font-semibold text-fg">
                Reproduce locally
              </h2>
              <CodeBlock
                code={`curl -fsSLo aftershock.mjs https://raw.githubusercontent.com/MaanavKrishna/Aftershock/main/action/dist/aftershock.mjs\nnode aftershock.mjs prove --fix ${inc.fixSha?.slice(0, 7) ?? "<fix>"} --test ${run.testPath ?? "<test file>"}`}
              />
            </section>
            {run.status !== "running" && !proven && (
              <Card>
                <CardHead sub="The new draft faces the same time travel">Not convinced?</CardHead>
                <CardBody>
                  <form action={retryTimeTravel} className="flex flex-col gap-3">
                    <input type="hidden" name="incidentId" value={inc.id} />
                    <TextArea label="Hint" name="hint" rows={2} placeholder="e.g. the bug only shows when the first response is lost" className="" />
                    <SubmitButton className={buttonClass("primary", "md", "w-full")} pendingLabel="Starting…">
                      Redraft and re-run
                    </SubmitButton>
                  </form>
                </CardBody>
              </Card>
            )}
          </aside>
        </div>
      </Main>
    </>
  );
}
