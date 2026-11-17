import type { Metadata } from "next";
import Link from "next/link";
import { currentScope } from "@/lib/auth/scope";
import { TopBar, Main, PageTitle } from "@/components/app/TopBar";
import { ButtonLink, buttonClass } from "@/components/ui/Button";
import { Card, CardHead } from "@/components/ui/Card";
import { Verdict } from "@/components/ui/Verdict";
import { Pill } from "@/components/ui/Pill";
import { listImportableIssues } from "@/lib/github/issues";
import { importIssue, backfillAction } from "../../actions";
import { IncidentForm, PostmortemForm } from "./forms";

export const metadata: Metadata = { title: "New incident" };

const TABS = [
  ["issue", "GitHub issue", "Fix found from links", "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 9v4 M12 16h.01"],
  ["postmortem", "Postmortem", "Paste it; the model extracts", "M6 3h9l4 4v14H6z M14 3v5h5 M9 13h7 M9 17h5"],
  ["form", "Form", "Write it by hand", "M4 5h16v14H4z M8 9h8 M8 13h5"],
  ["alert", "Alerts", "Sentry and PagerDuty", "M3 18 12 4l9 14H3z M12 10v3 M12 15.5h.01"],
] as const;

/** The incident from github.com/MaanavKrishna/aftershock-sample; forks keep the same fix commit. */
const SAMPLE = {
  title: "Discount applied twice when the cart is refreshed",
  trigger: "A shopper refreshed the cart page while applying a discount code.",
  observed: "The same code (WELCOME10) was applied twice: a 100.00 cart came to 81.00 instead of 90.00.",
  expected: "A discount code applies at most once per cart.",
  fix: "3d8fb011453a9595175eab8500f741948225e4b9",
  severity: "SEV-2",
};

const NEXT: [string, string][] = [
  ["Draft", "The model reads the incident, the fix diff and nearby tests."],
  ["Before the fix", "The draft runs three times on the parent commit. It must fail."],
  ["On the fix", "It runs three times on the fix commit. It must pass."],
  ["Bot pull request", "The proven test is proposed to your repository for review."],
];

export default async function NewIncident({ searchParams }: { searchParams: Promise<{ tab?: string; sample?: string }> }) {
  const { tab: raw, sample } = await searchParams;
  const tab = TABS.some((t) => t[0] === raw) ? raw! : "issue";
  const { scope } = await currentScope();
  const [repos, issues, integrations] = await Promise.all([scope.repos(), tab === "issue" ? listImportableIssues(scope) : Promise.resolve([]), scope.integrations()]);
  const repoOpts = repos.map((r) => ({ id: r.id, name: r.name }));
  return (
    <>
      <TopBar crumbs={[{ label: "Incidents", href: "/incidents" }, { label: "New" }]} />
      <Main>
        <PageTitle title="Bring an incident in." sub="However it was written down, Aftershock needs three things: what broke, where, and the commit that fixed it." />
        <nav aria-label="Incident source">
          <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0 lg:grid-cols-4">
            {TABS.map(([id, label, sub, icon]) => {
              const on = tab === id;
              return (
                <li key={id}>
                  <Link
                    href={`/incidents/new?tab=${id}`}
                    aria-current={on ? "page" : undefined}
                    className={`flex h-full min-h-16 items-center gap-3 rounded-card border px-4 py-3 no-underline transition-[border-color,background-color,box-shadow] duration-150 ease-fl ${on ? "border-fg bg-s1 shadow-e1" : "border-border bg-s1/60 hover:border-border-strong hover:bg-s1"}`}
                  >
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-control ${on ? "bg-fg text-canvas" : "bg-s2 text-fg-2"}`}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d={icon} />
                      </svg>
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="text-ui font-medium text-fg">{label}</span>
                      <span className="truncate text-caption text-fg-3">{sub}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="grid items-start gap-4 lg:grid-cols-3">
          <Card className="min-w-0 lg:col-span-2">
            {tab === "issue" && (
              <form action={importIssue} className="flex flex-col gap-4 p-5">
                {issues.length === 0 ? (
                  <p className="m-0 text-ui text-fg-2">
                    No closed issues are waiting. Label an issue <span className="rounded-chip bg-recur-soft px-1.5 font-mono text-callout text-recur">incident</span> on GitHub and close it with its fix, or install the GitHub App on more repositories.
                  </p>
                ) : (
                  <fieldset className="m-0 overflow-hidden rounded-control border border-border p-0">
                    <legend className="sr-only">Closed issues labelled incident</legend>
                    {issues.map((i, n) => (
                      <label key={`${i.repoId}:${i.number}`} className="flex min-h-14 cursor-pointer items-center gap-3 border-b border-border-soft px-4 py-3 last:border-b-0 hover:bg-s2/60 has-[:checked]:bg-signal-soft">
                        <input type="radio" name="issue" value={`${i.repoId}:${i.number}`} defaultChecked={n === 0} className="h-4 w-4 shrink-0 accent-signal" />
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="font-medium text-fg">{i.title}</span>
                          <span className="font-mono text-caption text-fg-3">
                            {i.repo} #{i.number} · closed {i.closedAt}
                          </span>
                        </span>
                        {i.fixSha || i.fixPr ? <Pill tone="neutral" mono>{i.fixSha ? `fix ${i.fixSha}` : `fix PR #${i.fixPr}`}</Pill> : <Pill tone="dashed">no fix linked</Pill>}
                      </label>
                    ))}
                  </fieldset>
                )}
                {issues.length > 0 && (
                  <div className="flex flex-wrap justify-end gap-2">
                    <button type="submit" name="intent" value="save" className={buttonClass("secondary")}>
                      Save only
                    </button>
                    <button type="submit" name="intent" value="travel" className={buttonClass("primary")}>
                      Save and time travel
                    </button>
                  </div>
                )}
              </form>
            )}
            {tab === "issue" && issues.length > 1 && (
              <form action={backfillAction} className="flex flex-wrap items-center justify-between gap-3 border-t border-border-soft bg-s2/40 px-5 py-4">
                <input type="hidden" name="limit" value={Math.min(issues.length, 25)} />
                <span className="flex-[1_1_300px] text-callout text-fg-2">Import all {Math.min(issues.length, 25)} at once. Those closed by a fix start time travel, three at a time.</span>
                <button type="submit" className={buttonClass("secondary", "sm")}>
                  Import all and time travel
                </button>
              </form>
            )}
            {tab === "postmortem" && <PostmortemForm repos={repoOpts} />}
            {tab === "form" && <IncidentForm key={sample ?? "blank"} repos={repoOpts} initial={sample ? { ...SAMPLE, repoId: repos.find((r) => r.name === "aftershock-sample")?.id ?? "" } : undefined} />}
            {tab === "form" && !sample && (
              <p className="m-0 border-t border-border-soft px-5 py-4 text-callout text-fg-2">
                No incident handy? Fork{" "}
                <a href="https://github.com/MaanavKrishna/aftershock-sample" className="text-signal underline underline-offset-2">
                  aftershock-sample
                </a>
                , install the app on your fork, then{" "}
                <Link href="/incidents/new?tab=form&sample=1" className="text-signal underline underline-offset-2">
                  fill in its incident
                </Link>
                .
              </p>
            )}
            {tab === "alert" && (
              <div className="flex flex-col gap-4 p-5">
                <p className="m-0 text-ui text-fg-2">
                  Alerts open incidents on their own. They wait in <strong className="font-medium text-fg">Awaiting fix</strong> until a pull request that mentions the incident ID merges, then time travel starts automatically.
                </p>
                <ul className="m-0 list-none overflow-hidden rounded-control border border-border p-0">
                  {(["sentry", "pagerduty"] as const).map((k) => {
                    const i = integrations.find((x) => x.kind === k);
                    return (
                      <li key={k} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border-soft px-4 py-3.5 last:border-b-0">
                        <span className="flex-[1_1_140px] font-medium text-fg">{k === "sentry" ? "Sentry" : "PagerDuty"}</span>
                        <span className="flex-[2_1_220px] text-callout text-fg-3">{i?.config.rule ?? i?.config.services ?? "Not connected"}</span>
                        {i?.enabled ? <Verdict kind="healthy" label="Connected" size="sm" /> : <Verdict kind="unproven" label="Not connected" size="sm" />}
                      </li>
                    );
                  })}
                </ul>
                <ButtonLink href="/integrations" variant="secondary" size="sm" className="self-start">
                  Manage integrations
                </ButtonLink>
              </div>
            )}
          </Card>
          <Card className="min-w-0">
            <CardHead>What happens next</CardHead>
            <ol className="m-0 flex list-none flex-col gap-4 px-5 py-4">
              {NEXT.map(([t, d], i) => (
                <li key={t} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border-strong text-caption font-medium tabular-nums text-fg-2">{i + 1}</span>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-callout font-medium text-fg">{t}</span>
                    <span className="text-callout text-fg-3">{d}</span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="m-0 border-t border-border-soft px-5 py-3.5 text-callout text-fg-2">No fix commit yet? Save it anyway. It waits in Awaiting fix and never gets a guessed test.</p>
          </Card>
        </div>
      </Main>
    </>
  );
}
