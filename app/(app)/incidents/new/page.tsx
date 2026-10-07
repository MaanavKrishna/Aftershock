import Link from "next/link";
import { currentScope } from "@/lib/auth/scope";
import { TopBar, Main, PageTitle } from "@/components/app/TopBar";
import { ButtonLink } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { listImportableIssues } from "@/lib/github/issues";
import { importIssue } from "../../actions";
import { IncidentForm, PostmortemForm } from "./forms";

const TABS = [
  ["issue", "GitHub issue", "Fix found from links", "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 9v4 M12 16h.01"],
  ["postmortem", "Postmortem", "Paste; AI extracts", "M6 3h9l4 4v14H6z M14 3v5h5 M9 13h7 M9 17h5"],
  ["form", "Form", "Write it by hand", "M4 5h16v14H4z M8 9h8 M8 13h5"],
  ["alert", "Alerts", "Sentry and PagerDuty", "M3 18 12 4l9 14H3z M12 10v3 M12 15.5h.01"],
] as const;

export default async function NewIncident({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: raw } = await searchParams;
  const tab = TABS.some((t) => t[0] === raw) ? raw! : "issue";
  const { scope } = await currentScope();
  const [repos, issues, integrations] = await Promise.all([scope.repos(), tab === "issue" ? listImportableIssues(scope) : Promise.resolve([]), scope.integrations()]);
  const repoOpts = repos.map((r) => ({ id: r.id, name: r.name }));
  return (
    <>
      <TopBar crumbs={[{ label: "Incidents", href: "/incidents" }, { label: "New" }]} />
      <Main>
        <PageTitle title="Bring an incident in." sub="However it was written down, Aftershock needs three things: what broke, where, and the commit that fixed it." />
        <nav aria-label="Incident source" className="grid grid-cols-[repeat(auto-fit,minmax(min(180px,100%),1fr))] gap-2">
          {TABS.map(([id, label, sub, icon]) => (
            <Link key={id} href={`/incidents/new?tab=${id}`} aria-current={tab === id ? "page" : undefined} className={`flex min-h-16 items-center gap-3 rounded-xl bg-white px-4 py-3 text-ink no-underline ${tab === id ? "border-2 border-ink" : "border border-line"}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={icon} /></svg>
              <span className="flex flex-col"><span className="font-semibold">{label}</span><span className="text-xs text-muted">{sub}</span></span>
            </Link>
          ))}
        </nav>
        <div className="flex flex-wrap items-start gap-4">
          <section className="min-w-0 flex-[1.7_1_560px] rounded-[14px] border border-line bg-card shadow-[0_1px_2px_rgba(14,20,27,0.04)]">
            {tab === "issue" && (
              <form action={importIssue} className="flex flex-col gap-4 p-6">
                {issues.length === 0 ? (
                  <p className="m-0 text-muted">No closed issues are waiting. Label an issue <span className="rounded-[5px] bg-fail-tint px-1.5 font-mono text-[13px] text-fail-ink">incident</span> on GitHub and close it with its fix, or install the GitHub App on more repositories.</p>
                ) : (
                  <fieldset className="m-0 overflow-hidden rounded-xl border border-line p-0">
                    <legend className="sr-only">Closed issues labelled incident</legend>
                    {issues.map((i, n) => (
                      <label key={`${i.repoId}:${i.number}`} className="flex min-h-[60px] cursor-pointer items-center gap-3.5 border-b border-line-soft px-4 py-3 has-[:checked]:bg-pass-wash">
                        <input type="radio" name="issue" value={`${i.repoId}:${i.number}`} defaultChecked={n === 0} className="h-[18px] w-[18px] accent-ink" />
                        <span className="flex min-w-0 flex-1 flex-col"><span className="font-semibold">{i.title}</span><span className="font-mono text-xs text-muted">{i.repo} #{i.number} · closed {i.closedAt}</span></span>
                        <Pill tone={i.fixSha || i.fixPr ? "pass" : "dashed"} mono>{i.fixSha ? `fix ${i.fixSha}` : i.fixPr ? `fix PR #${i.fixPr}` : "no fix linked"}</Pill>
                      </label>
                    ))}
                  </fieldset>
                )}
                {issues.length > 0 && (
                  <div className="flex flex-wrap justify-end gap-2.5">
                    <button type="submit" name="intent" value="save" className="inline-flex min-h-11 cursor-pointer items-center rounded-[9px] border border-line-strong bg-white px-4 font-semibold">Save only</button>
                    <button type="submit" name="intent" value="travel" className="inline-flex min-h-11 cursor-pointer items-center rounded-[9px] bg-ink px-[18px] font-semibold text-white">Save and time travel</button>
                  </div>
                )}
              </form>
            )}
            {tab === "postmortem" && <PostmortemForm repos={repoOpts} />}
            {tab === "form" && <IncidentForm repos={repoOpts} />}
            {tab === "alert" && (
              <div className="flex flex-col gap-4 p-6">
                <p className="m-0 text-body">Alerts open incidents on their own. They wait in <strong>Awaiting fix</strong> until a pull request that mentions the incident ID merges — then time travel starts automatically.</p>
                <div className="overflow-hidden rounded-xl border border-line">
                  {(["sentry", "pagerduty"] as const).map((k) => {
                    const i = integrations.find((x) => x.kind === k);
                    return (
                      <div key={k} className="flex flex-wrap items-center gap-x-4 gap-y-2.5 border-b border-line-soft px-[18px] py-4">
                        <span className="flex-[1_1_160px] font-semibold">{k === "sentry" ? "Sentry" : "PagerDuty"}</span>
                        <span className="flex-[2_1_240px] text-[13px] text-muted">{i?.config.rule ?? i?.config.services ?? "Not connected"}</span>
                        <Pill tone={i?.enabled ? "pass" : "dashed"}>{i?.enabled ? "Connected" : "Not connected"}</Pill>
                      </div>
                    );
                  })}
                </div>
                <ButtonLink href="/integrations" variant="secondary" className="self-start">Manage integrations</ButtonLink>
              </div>
            )}
          </section>
          <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-4 rounded-[14px] bg-ink p-[22px] text-on-dark">
            <span className="font-semibold">What happens next</span>
            {[["01", "Draft", "The model reads the incident, the fix diff and nearby tests."], ["02", "Before the fix", "The draft runs 3 times on the parent commit. It must fail."], ["03", "On the fix", "It runs 3 times on the fix commit. It must pass."], ["04", "Bot PR", "The proven test is proposed to your repo for review."]].map(([n, t, d]) => (
              <div key={n} className="flex gap-3"><span className="w-[22px] shrink-0 font-mono text-[12.5px] text-pass-dark">{n}</span><span className="flex flex-col gap-0.5"><span className="text-[13.5px] font-semibold">{t}</span><span className="text-[12.5px] text-on-dark-muted">{d}</span></span></div>
            ))}
            <div className="mt-1 rounded-[10px] border border-ink-line bg-ink-2 px-3.5 py-3 text-[12.5px] text-on-dark-muted">No fix commit yet? Save it anyway. It waits in Awaiting fix and never gets a guessed test.</div>
          </aside>
        </div>
      </Main>
    </>
  );
}
