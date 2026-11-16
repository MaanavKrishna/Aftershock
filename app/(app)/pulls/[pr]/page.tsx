import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { currentScope } from "@/lib/auth/scope";
import { TopBar, Main } from "@/components/app/TopBar";
import { Card, CardHead } from "@/components/ui/Card";
import { VerdictPill } from "@/components/ui/Pill";
import { Verdict } from "@/components/ui/Verdict";
import { ButtonLink, buttonClass } from "@/components/ui/Button";
import { ChevronDown, External } from "@/components/ui/icons";
import { AutoRefresh } from "@/components/app/AutoRefresh";
import { CheckCard } from "@/components/app/CheckCard";
import { KeyValue } from "@/components/app/bits";
import { incidentKey } from "@/lib/domain/ids";
import { duration, stamp } from "@/lib/format";
import { requestSuggestedFix } from "../../actions";
import { OverrideForm } from "./OverrideForm";
import { can } from "@/lib/auth/roles";

export async function generateMetadata({ params }: { params: Promise<{ pr: string }> }): Promise<Metadata> {
  const { pr } = await params;
  return { title: `Pull request #${pr}` };
}

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
  const recur = results.filter((r) => r.result.verdict === "recur");
  const sel = results.find((r) => String(r.incident.number) === sp.inc) ?? results[0];
  const headline =
    verdict === "recur"
      ? `This change would ship ${key(recur[0].incident.number)} again.`
      : verdict === "safe"
        ? "This change keeps every lesson it touches."
        : verdict === "inconclusive"
          ? "The results were mixed, so this is not green."
          : verdict === "skipped"
            ? "No remembered incident is relevant to this change."
            : "Checking this change against memory…";
  const sub =
    verdict === "recur"
      ? `The proven test for “${recur[0].incident.title}” failed on ${recur[0].result.runs.filter((r) => r.outcome === "failed").length} of ${recur[0].result.runs.length} runs.`
      : verdict === "inconclusive"
        ? "At least one test passed on some runs and failed on others, or the environment failed. Re-run, or mark the test flaky."
        : `${results.length} relevant test${results.length === 1 ? "" : "s"} ran; ${skips.length} incident${skips.length === 1 ? " was" : "s were"} skipped with reasons.`;
  // Stored as "--- <file>" headers followed by GitHub patches; headers are not changed lines.
  const diffLines = check.diff ? check.diff.split("\n").filter((l) => !l.startsWith("--- ")) : [];
  const counts = { recur: recur.length, safe: results.filter((r) => r.result.verdict === "safe").length, skipped: skips.length };
  const link = (n: number) => `?${new URLSearchParams({ ...(sp.repo ? { repo: sp.repo } : {}), inc: String(n) })}`;

  const next =
    verdict === "recur" ? (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-ui font-semibold text-fg">What next</span>
          <span className="text-callout text-fg-2">Ask for a suggested fix. It is checked against {key(recur[0].incident.number)} and every other memory test for this repository before anyone sees it.</span>
        </div>
        {!fix && (
          <form action={requestSuggestedFix}>
            <input type="hidden" name="checkId" value={check.id} />
            <SubmitButton className={buttonClass("primary", "sm", "w-full sm:w-auto")} pendingLabel="Requesting…">
              Suggest a fix
            </SubmitButton>
          </form>
        )}
        {fix && (
          <div className="flex flex-col gap-1.5 rounded-control border border-border bg-s1 px-3.5 py-3">
            <span className="flex flex-wrap items-center gap-2">
              <Verdict kind={fix.status === "passed" ? "proven" : fix.status === "failed" ? "failing" : "running"} label={fix.status === "running" ? "Checking the suggested fix" : fix.status === "passed" ? `Fix passed ${fix.results.length}/${fix.results.length} memory tests` : "Did not pass every memory test"} size="sm" />
            </span>
            <span className="text-callout text-fg-2">{fix.explanation || "Posted as a suggestion on the pull request. A person applies it."}</span>
          </div>
        )}
        {canOverride ? <OverrideForm checkId={check.id} /> : null}
        <span className="text-caption text-fg-3">{canOverride ? "Overrides are recorded on the incident’s trail." : "Only owners and admins can override a check."}</span>
      </div>
    ) : undefined;

  return (
    <>
      <AutoRefresh active={check.status !== "done" || fix?.status === "running"} />
      <TopBar crumbs={[{ label: "Pull requests", href: "/pulls" }, { label: `#${check.prNumber}` }]}>
        <ButtonLink href={`https://github.com/${repo.fullName}/pull/${check.prNumber}`} variant="secondary" size="sm" className="max-sm:hidden">
          Open on GitHub
          <External size={14} />
        </ButtonLink>
      </TopBar>
      <Main>
        <header className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <VerdictPill verdict={check.verdict} />
            <span className="text-callout text-fg-3">
              <span className="font-mono">#{check.prNumber}</span> · {repo.name} · head <span className="font-mono">{check.headSha.slice(0, 7)}</span> · {stamp(check.createdAt)}
              {check.runner ? ` · ${duration(check.durationMs)} in ${check.runner}` : ""}
            </span>
          </div>
          <h1 className="m-0 max-w-3xl text-title-1 font-semibold text-balance text-fg">{headline}</h1>
          <p className="m-0 max-w-3xl text-ui text-fg-2">“{check.title}”</p>
        </header>

        <div className="grid items-start gap-4 lg:grid-cols-3">
          <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
            <CheckCard
              verdict={check.verdict}
              mode={repo.checkMode === "blocking" ? "blocking" : "advisory"}
              overridden={check.overridden}
              summary={sub}
              risk={check.risk}
              rows={results.map(({ result, incident }) => ({
                id: result.id,
                key: key(incident.number),
                title: incident.title,
                why: result.why,
                verdict: result.verdict,
                runs: result.runs,
                href: link(incident.number),
                selected: sel?.result.id === result.id,
              }))}
              emptyText={check.status === "done" ? "No memory test was relevant to the files this pull request changed." : "Selecting relevant tests…"}
              next={next}
            />

            {sel && (
              <Card>
                <CardHead sub={<span className="font-mono">{sel.test.fn}</span>} aside={<VerdictPill verdict={sel.result.verdict} />}>
                  Trace · {key(sel.incident.number)} · run 1
                </CardHead>
                <ol className="m-0 list-none bg-sunken px-5 py-3 font-mono text-callout">
                  {sel.result.trace.map((t, i) => (
                    <li key={i} className="flex gap-3 border-b border-dashed border-border py-2 last:border-b-0">
                      <span className="w-5 shrink-0 tabular-nums text-fg-3">{String(i + 1).padStart(2, "0")}</span>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className={t.bad ? "text-recur" : "text-fg"}>{t.head}</span>
                        <span className="text-fg-3">{t.sub}</span>
                      </span>
                    </li>
                  ))}
                </ol>
                <p className={`m-0 border-t border-border-soft px-5 py-3 font-mono text-caption ${sel.result.verdict === "recur" ? "bg-recur-soft text-recur" : "text-fg-2"}`}>
                  {sel.result.failureExcerpt ?? `${sel.result.runs.filter((r) => r.outcome === "passed").length} passed · ${sel.result.runs.length}/${sel.result.runs.length} runs`}
                </p>
              </Card>
            )}

            {diffLines.length > 0 && (
              <Card>
                <CardHead sub={<span className="font-mono">{check.changedFiles[0]}</span>} aside={<span className="text-caption text-recur">{diffLines.filter((l) => l.startsWith("-")).length} lines removed on a fault line</span>}>
                  The change
                </CardHead>
                <div tabIndex={0} role="region" aria-label="Diff" className="overflow-x-auto bg-sunken py-2">
                  {diffLines.map((l, i) => (
                    <div key={i} className={`flex whitespace-pre pr-5 font-mono text-caption leading-relaxed ${l.startsWith("-") ? "bg-recur-soft text-recur" : l.startsWith("+") ? "bg-s2 text-fg" : "text-fg-3"}`}>
                      <span className="w-6 shrink-0 select-none text-center" aria-hidden="true">
                        {l[0] === "-" ? "−" : l[0] === "+" ? "+" : " "}
                      </span>
                      <span className="sr-only">{l[0] === "-" ? "removed: " : l[0] === "+" ? "added: " : ""}</span>
                      <span>{l.slice(1)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {skips.length > 0 && (
              <details className="group overflow-hidden rounded-card border border-border bg-s1 shadow-e1">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-5 text-ui font-semibold text-fg [&::-webkit-details-marker]:hidden">
                  {skips.length} incident{skips.length === 1 ? "" : "s"} skipped, with reasons
                  <span className="text-fg-3 transition-transform duration-200 ease-fl group-open:rotate-180">
                    <ChevronDown size={16} />
                  </span>
                </summary>
                <ul className="m-0 list-none p-0">
                  {skips.map(({ skip, incident }) => (
                    <li key={skip.id} className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border-soft px-5 py-2.5 text-callout">
                      <span className="w-14 font-mono text-fg-3">{key(incident.number)}</span>
                      <span className="flex-[1_1_200px] font-medium text-fg">{incident.title}</span>
                      <span className="flex-[1_1_220px] text-fg-3">{skip.reason}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>

          <aside className="flex min-w-0 flex-col gap-4" aria-label="Check details">
            <section aria-label="Results" className="grid grid-cols-3 overflow-hidden rounded-card border border-border bg-s1 shadow-e1">
              {(
                [
                  ["Recur", counts.recur, "text-recur"],
                  ["Safe", counts.safe, "text-safe"],
                  ["Skipped", counts.skipped, "text-fg"],
                ] as const
              ).map(([k, v, c], i) => (
                <div key={k} className={`flex flex-col gap-0.5 px-4 py-3.5 ${i < 2 ? "border-r border-border-soft" : ""}`}>
                  <span className="text-caption text-fg-3">{k}</span>
                  <span className={`text-title-2 font-semibold tabular-nums ${v > 0 ? c : "text-fg-3"}`}>{v}</span>
                </div>
              ))}
            </section>
            <Card>
              <CardHead sub="Updated in place on every push">Comment on the pull request</CardHead>
              <div className="flex flex-col gap-2.5 px-5 py-4">
                <span className="flex">
                  {verdict === "recur" ? <Verdict kind="recur" label={`${recur.length} incident${recur.length === 1 ? "" : "s"} would recur`} size="sm" /> : <VerdictPill verdict={check.verdict} />}
                </span>
                <span className="text-callout text-fg-2">
                  {verdict === "recur"
                    ? `This change reopens ${key(recur[0].incident.number)}: ${recur[0].incident.title.toLowerCase()}. ${counts.safe} related incident${counts.safe === 1 ? "" : "s"} passed; ${counts.skipped} skipped.`
                    : sub}
                </span>
              </div>
            </Card>
            {overrides.length > 0 && (
              <Card>
                <CardHead>Overrides</CardHead>
                <ul className="m-0 list-none p-0">
                  {overrides.map(({ o, user }) => (
                    <li key={o.id} className="border-b border-border-soft px-5 py-3 text-callout last:border-b-0">
                      <span className="font-medium text-fg">{user ? (user.name ?? user.login) : "Former member"}</span> <span className="text-fg-3">· {stamp(o.createdAt)}</span>
                      <p className="m-0 mt-1 text-fg-2">{o.reason}</p>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            <Card>
              <CardHead>Environment</CardHead>
              <KeyValue
                rows={[
                  ["Runner", check.runner === "sandbox" ? "Aftershock sandbox" : check.runner === "actions" ? "Your GitHub Actions" : "—"],
                  ["Base", `${repo.defaultBranch} @ ${check.baseSha.slice(0, 7)}`],
                  ["Head", check.headSha.slice(0, 7)],
                  ["Framework", repo.framework],
                  ["Runs per test", "3"],
                  ["Model", "triage only"],
                ]}
              />
            </Card>
            <ButtonLink href={`https://github.com/${repo.fullName}/pull/${check.prNumber}`} variant="secondary" size="sm" className="sm:hidden">
              Open on GitHub
              <External size={14} />
            </ButtonLink>
          </aside>
        </div>
      </Main>
    </>
  );
}
