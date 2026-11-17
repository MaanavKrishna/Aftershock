import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { EditIncident } from "@/components/app/EditIncident";
import { currentScope } from "@/lib/auth/scope";
import { TopBar, Main } from "@/components/app/TopBar";
import { Card, CardHead, CardBody } from "@/components/ui/Card";
import { Pill, StatusPill, VerdictPill } from "@/components/ui/Pill";
import { Verdict } from "@/components/ui/Verdict";
import { ButtonLink, buttonClass } from "@/components/ui/Button";
import { TextField, TextArea } from "@/components/ui/Field";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { External } from "@/components/ui/icons";
import { Strip, toCells } from "@/components/ui/Strip";
import { TONE_DOT, Eyebrow } from "@/components/app/bits";
import { SOURCES } from "@/components/app/sources";
import { AutoRefresh } from "@/components/app/AutoRefresh";
import { ProofTimeline } from "@/components/app/ProofTimeline";
import { incidentKey } from "@/lib/domain/ids";
import { stamp, timeAgo } from "@/lib/format";
import { acceptSuggestedFix, addAnotherTest, addNote, deleteIncidentAction, dismissSuggestedFix, linkFix, rerunRelated, retryTimeTravel, searchEpicenter } from "../../actions";
import { ConfirmDelete } from "@/components/app/ConfirmDelete";
import { can } from "@/lib/auth/roles";

export async function generateMetadata({ params }: { params: Promise<{ number: string }> }): Promise<Metadata> {
  const { number } = await params;
  return { title: `Incident ${number}` };
}

const short = (sha: string | null | undefined) => (sha ? sha.slice(0, 7) : null);

export default async function IncidentPage({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<{ error?: string }> }) {
  const { number } = await params;
  const { error } = await searchParams;
  const { scope, session } = await currentScope();
  const inc = await scope.getIncident(Number(number));
  if (!inc) notFound();
  const tests = await scope.memoryTestsForIncident(inc.id);
  const [ws, repo, runs, mem, checks, notes, trail] = await Promise.all([
    scope.workspace(),
    inc.repoId ? scope.repo(inc.repoId) : null,
    scope.runs(inc.id),
    scope.memoryForIncident(inc.id),
    scope.checksForIncident(inc.id),
    scope.notes(inc.id),
    scope.trail(inc.id),
  ]);
  const key = incidentKey(ws?.incidentPrefix ?? "INC", inc.number);
  const admin = can((await scope.me(session.userId))?.role, "manageWorkspace");
  const proven = runs.find((r) => r.status === "proven");
  const latest = runs.at(-1);
  const shown = proven ?? latest;
  const epic = inc.epicenter && "sha" in inc.epicenter ? inc.epicenter : null;
  const epicMissing = inc.epicenter && "unavailable" in inc.epicenter ? inc.epicenter.unavailable : null;
  const hasFix = Boolean(inc.fixSha || inc.fixPr);
  const proofKind = inc.status === "proven" ? "proven" : inc.status === "traveling" ? "running" : inc.status === "awaiting_fix" ? "awaiting" : inc.status === "rejected" ? "rejected" : "unproven";

  return (
    <>
      <TopBar crumbs={[{ label: "Incidents", href: "/incidents" }, { label: key }]} />
      <AutoRefresh active={inc.status === "traveling"} />
      <Main>
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex min-w-0 max-w-3xl flex-col gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={inc.status} />
              <Pill tone="neutral" mono>
                {key}
              </Pill>
              {repo && (
                <Pill tone="neutral" mono>
                  {repo.name}
                </Pill>
              )}
              <Pill tone={inc.severity === "SEV-1" ? "fail" : "neutral"} mono>
                {inc.severity}
              </Pill>
              <span className="text-callout text-fg-3">
                From {SOURCES[inc.source][0].toLowerCase()}
                {inc.sourceRef ? ` ${inc.sourceRef}` : ""} · {stamp(inc.createdAt)}
              </span>
            </div>
            <h1 className="m-0 text-title-1 font-semibold text-balance text-fg">{inc.title}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {runs.length > 0 && (
              <ButtonLink href={`/incidents/${inc.number}/travel`} variant="secondary" size="sm">
                View time travel
              </ButtonLink>
            )}
            {runs.length > 0 && (
              <ButtonLink href={`/incidents/${inc.number}/evidence`} variant="secondary" size="sm">
                Evidence
              </ButtonLink>
            )}
            {mem?.botPr && (
              <ButtonLink href={repo ? `https://github.com/${repo.fullName}/pull/${mem.botPr}` : "#"} size="sm">
                {mem.botPrState === "open" ? `Review bot PR #${mem.botPr}` : `Bot PR #${mem.botPr} · ${mem.botPrState}`}
                <External size={14} />
              </ButtonLink>
            )}
          </div>
        </header>

        {inc.related.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-card border border-recur-line bg-recur-soft px-4 py-3 text-ui">
            <span className="flex-[1_1_320px] text-fg">
              <strong className="font-semibold text-recur">
                Looks like{" "}
                <Link href={`/incidents/${inc.related[0].key.split("-").pop()}`} className="text-inherit underline underline-offset-2">
                  {inc.related[0].key}
                </Link>{" "}
                again.
              </strong>{" "}
              {inc.related[0].why}
            </span>
            <form action={rerunRelated}>
              <input type="hidden" name="incidentId" value={inc.related[0].id} />
              <SubmitButton className={buttonClass("dangerOutline", "sm")} pendingLabel="Starting…">{`Re-run ${inc.related[0].key}'s test on main`}</SubmitButton>
            </form>
          </div>
        )}
        {inc.suggestedFix && inc.status === "awaiting_fix" && (
          <div className="flex flex-wrap items-center gap-3 rounded-card border border-border bg-s1 px-4 py-3 text-ui shadow-e1">
            <span className="flex-[1_1_320px] text-fg-2">
              <strong className="font-semibold text-fg">PR #{inc.suggestedFix.pr} probably fixed this.</strong> {inc.suggestedFix.title} · {inc.suggestedFix.why}
            </span>
            <form action={acceptSuggestedFix}>
              <input type="hidden" name="incidentId" value={inc.id} />
              <SubmitButton className={buttonClass("primary", "sm")} pendingLabel="Starting…">
                Link and time travel
              </SubmitButton>
            </form>
            <form action={dismissSuggestedFix}>
              <input type="hidden" name="incidentId" value={inc.id} />
              <SubmitButton className={buttonClass("secondary", "sm")} pendingLabel="…">
                Not this one
              </SubmitButton>
            </form>
          </div>
        )}

        <div className="grid items-start gap-4 lg:grid-cols-3">
          <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
            <Card>
              <CardHead sub={shown ? `Attempt ${shown.attempt} of ${runs.length}` : hasFix ? "Not run yet" : "Link the fix to start"} aside={<Verdict kind={proofKind} size="sm" />}>
                Proof
              </CardHead>
              {hasFix ? (
                <ProofTimeline
                  incident={{ key, opened: stamp(inc.createdAt), source: SOURCES[inc.source][0].toLowerCase(), observed: inc.observed }}
                  before={{ sha: short(inc.parentSha) ?? "parent", title: "the commit before the fix", runs: shown?.beforeResults ?? [], must: "fail" }}
                  fix={{ sha: short(inc.fixSha) ?? `PR #${inc.fixPr}`, title: inc.fixTitle ?? "the fix", runs: shown?.fixResults ?? [], must: "pass" }}
                  footer={
                    shown && (
                      <>
                        <span>{proven ? `Drafted by ${proven.model ?? "the model"} · proven ${stamp(proven.finishedAt)}` : `Attempt ${shown.attempt}: ${shown.reason ?? "running"}`}</span>
                        <Link href={`/incidents/${inc.number}/travel`} className="font-medium text-signal no-underline hover:underline">
                          Open the run
                        </Link>
                      </>
                    )
                  }
                />
              ) : (
                <form action={linkFix} className="flex flex-wrap items-end gap-3 px-5 py-4">
                  <input type="hidden" name="incidentId" value={inc.id} />
                  <TextField
                    label="Fix commit or pull request"
                    name="fix"
                    required
                    mono
                    placeholder="SHA, #PR or GitHub URL"
                    error={error === "fix" ? "Enter a commit SHA, a PR number like #44, or a GitHub URL." : undefined}
                    className="flex-[1_1_280px]"
                  />
                  <SubmitButton className={buttonClass("primary")} pendingLabel="Starting…">
                    Link fix and time travel
                  </SubmitButton>
                </form>
              )}
              {inc.statusReason && (inc.status === "awaiting_fix" || inc.status === "unproven" || inc.status === "rejected") && (
                <p className="m-0 border-t border-border-soft px-5 py-3 text-callout text-fg-2">{inc.statusReason}</p>
              )}
              {inc.status === "awaiting_fix" && hasFix && (
                <div className="flex flex-wrap items-end gap-3 border-t border-border-soft px-5 py-4">
                  <form action={retryTimeTravel}>
                    <input type="hidden" name="incidentId" value={inc.id} />
                    <SubmitButton className={buttonClass("primary")} pendingLabel="Starting…">
                      Start time travel
                    </SubmitButton>
                  </form>
                  <form action={linkFix} className="flex flex-[1_1_320px] flex-wrap items-end gap-3">
                    <input type="hidden" name="incidentId" value={inc.id} />
                    <TextField label="Or link a different fix" name="fix" required mono placeholder="SHA, #PR or GitHub URL" className="flex-[1_1_220px]" />
                    <SubmitButton className={buttonClass("secondary")} pendingLabel="Linking…">
                      Link fix
                    </SubmitButton>
                  </form>
                </div>
              )}
              {(epic || (mem && inc.status === "proven")) && (
                <div className="flex flex-col border-t border-border-soft">
                  {epic && (
                    <div className="flex flex-col gap-0.5 px-5 py-3.5">
                      <Eyebrow tone="recur">Epicenter</Eyebrow>
                      <span className="text-callout text-fg">
                        Introduced in <span className="font-mono">{short(epic.sha)}</span>
                        {epic.prNumber ? ` · PR #${epic.prNumber}` : ""}
                        {epic.title ? ` · ${epic.title}` : ""}
                      </span>
                      <span className="text-caption text-fg-3">
                        Found in {epic.testedCommits} runs{epic.arrivedWithCode ? " · arrived with the code it tests" : ""}
                      </span>
                    </div>
                  )}
                  {mem && inc.status === "proven" && !epic && (
                    <form action={searchEpicenter} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                      <input type="hidden" name="incidentId" value={inc.id} />
                      <span className="flex flex-[1_1_260px] flex-col gap-0.5">
                        <Eyebrow>Epicenter</Eyebrow>
                        <span className="text-callout text-fg-2">{epicMissing ?? "Searching history for the commit that introduced the bug…"}</span>
                      </span>
                      {epicMissing && (
                        <SubmitButton className={buttonClass("secondary", "sm")} pendingLabel="Starting…">
                          Search again
                        </SubmitButton>
                      )}
                    </form>
                  )}
                </div>
              )}
            </Card>

            <Card>
              <CardHead>What happened</CardHead>
              <dl className="m-0 grid md:grid-cols-3">
                {(
                  [
                    ["Trigger", inc.trigger, undefined],
                    ["Observed", inc.observed, "recur"],
                    ["Expected", inc.expected, "proven"],
                  ] as const
                ).map(([k, v, tone]) => (
                  <div key={k} className="flex flex-col gap-1 border-border-soft px-5 py-4 max-md:border-b md:border-r md:last:border-r-0">
                    <dt>
                      <Eyebrow tone={tone}>{k}</Eyebrow>
                    </dt>
                    <dd className="m-0 text-ui text-fg">{v || <span className="text-fg-3">Not recorded</span>}</dd>
                  </div>
                ))}
              </dl>
              <EditIncident id={inc.id} title={inc.title} trigger={inc.trigger} observed={inc.observed} expected={inc.expected} />
            </Card>

            {proven?.testCode && (
              <section aria-labelledby="test-h" className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 id="test-h" className="m-0 text-title-3 font-semibold text-fg">
                    The memory test
                  </h2>
                  <span className="flex items-center gap-2 text-caption text-fg-3">
                    <Strip cells={toCells(proven.beforeResults)} width={36} height={8} label={`Before the fix: ${proven.beforeResults.map((r) => r.outcome).join(", ")}`} />
                    <Strip cells={toCells(proven.fixResults)} width={36} height={8} label={`On the fix: ${proven.fixResults.map((r) => r.outcome).join(", ")}`} />
                    attempt {proven.attempt}
                  </span>
                </div>
                <CodeBlock code={proven.testCode} file={proven.testPath ?? undefined} />
              </section>
            )}

            {mem && inc.status === "proven" && (
              <Card>
                <CardHead sub={tests.map((x) => x.path).join(" · ")}>Memory tests</CardHead>
                <form action={addAnotherTest} className="flex flex-wrap items-end gap-3 px-5 py-4">
                  <input type="hidden" name="incidentId" value={inc.id} />
                  <TextField label="Another test (optional focus)" name="hint" maxLength={500} placeholder="e.g. cover it through the HTTP API" className="flex-[1_1_320px]" />
                  <SubmitButton className={buttonClass("secondary")} pendingLabel="Starting…">
                    Prove another test
                  </SubmitButton>
                </form>
              </Card>
            )}

            <Card>
              <CardHead aside={<span className="text-caption tabular-nums text-fg-3">{checks.length}</span>}>Pull requests this test has guarded</CardHead>
              <ul className="m-0 list-none p-0">
                {checks.map(({ check, result }) => (
                  <li key={check.id} className="border-b border-border-soft last:border-b-0">
                    <Link href={`/pulls/${check.prNumber}`} className="flex items-center gap-3 px-5 py-3 no-underline transition-colors duration-150 hover:bg-s2/60">
                      <span className="w-11 shrink-0 font-mono text-callout text-fg-3">#{check.prNumber}</span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-medium text-fg">{check.title}</span>
                        <span className="truncate text-caption text-fg-3">
                          {check.runner ?? "—"} · {stamp(check.createdAt)}
                        </span>
                      </span>
                      <span className="w-12 shrink-0 max-sm:hidden">
                        <Strip cells={toCells(result.runs, 3)} height={8} />
                      </span>
                      <VerdictPill verdict={result.verdict} />
                    </Link>
                  </li>
                ))}
              </ul>
              {checks.length === 0 && <p className="m-0 px-5 py-5 text-callout text-fg-3">{proven ? "No pull request has touched this code yet." : "Pull requests are guarded once the test is proven."}</p>}
            </Card>

            <Card>
              <CardHead aside={<span className="text-caption tabular-nums text-fg-3">{notes.length}</span>}>Notes</CardHead>
              <CardBody className="flex flex-col gap-4">
                {notes.map(({ note, user }) => (
                  <div key={note.id} className="flex gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-s3 text-caption font-semibold text-fg">{(user?.name ?? user?.login ?? "?")[0].toUpperCase()}</span>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-caption text-fg-3">
                        <span className="font-medium text-fg">{user ? (user.name ?? user.login) : "Former member"}</span> · {stamp(note.createdAt)}
                      </span>
                      <span className="text-ui text-fg">{note.text}</span>
                    </div>
                  </div>
                ))}
                <form action={addNote} className="flex flex-col gap-2">
                  <input type="hidden" name="incidentId" value={inc.id} />
                  <TextArea label="Add a note" name="text" rows={2} placeholder="Context for the next person who sees this test fail" className="" />
                  <SubmitButton className={buttonClass("secondary", "sm", "self-end")} pendingLabel="Adding…">
                    Add note
                  </SubmitButton>
                </form>
              </CardBody>
            </Card>

            {admin && (
              <Card>
                <CardHead sub="Owners and admins only">
                  Delete{" "}
                  <span data-testid="incident-key" className="font-mono">
                    {key}
                  </span>
                </CardHead>
                <CardBody>
                  <ConfirmDelete
                    action={deleteIncidentAction}
                    fields={{ incidentId: inc.id }}
                    expected={key}
                    button="Delete incident"
                    description="Deletes this incident, its time-travel runs, its memory test and its trail. Tests already merged into your repository stay there."
                  />
                </CardBody>
              </Card>
            )}
          </div>

          <aside className="flex min-w-0 flex-col gap-4" aria-label="Trail and related incidents">
            {inc.related.length > 0 && (
              <Card>
                <CardHead sub="Matched by files and symptoms">Related incidents</CardHead>
                <ul className="m-0 list-none p-0">
                  {inc.related.map((r) => (
                    <li key={r.id} className="border-b border-border-soft last:border-b-0">
                      <Link href={`/incidents/${r.key.split("-").pop()}`} className="flex flex-col gap-0.5 px-5 py-3 no-underline hover:bg-s2/60">
                        <span className="font-mono text-callout font-medium text-fg">{r.key}</span>
                        <span className="text-caption text-fg-3">{r.why}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            <Card>
              <CardHead>Trail</CardHead>
              <ol className="m-0 list-none px-5 pb-1 pt-4">
                {trail.map((t, i) => (
                  <li key={t.id} className="flex gap-3">
                    <span className="flex shrink-0 flex-col items-center" aria-hidden="true">
                      <span className={`mt-1.5 h-2 w-2 rounded-full ${TONE_DOT[t.tone] ?? TONE_DOT.neutral}`} />
                      {i < trail.length - 1 && <span className="mt-1 w-px flex-1 bg-border" />}
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5 pb-4">
                      <span className="text-callout font-medium text-fg">{t.title}</span>
                      {t.detail && <span className="text-caption text-fg-2">{t.detail}</span>}
                      <span className="text-caption text-fg-3" title={stamp(t.createdAt)}>
                        {timeAgo(t.createdAt)}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
              {trail.length === 0 && <p className="m-0 px-5 pb-4 text-callout text-fg-3">Nothing has happened yet.</p>}
            </Card>
          </aside>
        </div>
      </Main>
    </>
  );
}
