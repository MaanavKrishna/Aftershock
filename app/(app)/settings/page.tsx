import type { Metadata } from "next";
import Link from "next/link";
import { currentScope } from "@/lib/auth/scope";
import { TopBar } from "@/components/app/TopBar";
import { ButtonLink } from "@/components/ui/Button";
import { revokeToken } from "../actions";
import { WorkspaceForm, TokenForm } from "./forms";
import { hours, timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Settings" };

const TABS = [["workspace", "Workspace"], ["admission", "Admission rules"], ["team", "Team"], ["tokens", "API tokens"], ["billing", "Plan and usage"], ["danger", "Danger zone"]] as const;
const sectionCls = "overflow-hidden rounded-[14px] border border-line bg-card shadow-[0_1px_2px_rgba(14,20,27,0.04)]";

function Head({ title, sub, children }: { title: string; sub: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EDEEE9] px-6 py-[18px]">
      <span className="flex flex-col gap-0.5"><h2 className="m-0 text-lg font-semibold">{title}</h2><span className="text-[13px] text-muted">{sub}</span></span>
      {children}
    </div>
  );
}

export default async function Settings({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: t } = await searchParams;
  const tab = TABS.some(([id]) => id === t) ? t! : "workspace";
  const { scope } = await currentScope();
  const [ws, members, tokens, usage, repos] = await Promise.all([scope.workspace(), scope.members(), scope.tokens(), scope.usage(), scope.repos()]);
  if (!ws) return null;
  const privateRepos = repos.length;
  return (
    <>
      <TopBar title="Settings" />
      <main className="flex flex-wrap items-start gap-7 px-8 pb-16 pt-7 max-sm:px-4">
        <h1 className="sr-only">Settings · {TABS.find(([id]) => id === tab)![1]}</h1>
        <nav aria-label="Settings sections" className="flex max-w-full flex-[1_1_200px] flex-col gap-0.5">
          {TABS.map(([id, label]) => (
            <Link key={id} href={`/settings?tab=${id}`} aria-current={tab === id ? "page" : undefined} className={`flex min-h-[42px] items-center rounded-lg px-3 text-sm no-underline ${tab === id ? "bg-white font-semibold text-ink shadow-[inset_0_0_0_1px_#E2E3DD]" : id === "danger" ? "text-fail-deep" : "text-body"}`}>{label}</Link>
          ))}
        </nav>
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
          {tab === "workspace" && (
            <section className={sectionCls}>
              <Head title="Workspace" sub="Linked to your GitHub account or organisation." />
              <WorkspaceForm name={ws.name} prefix={ws.incidentPrefix} label={ws.settings.issueLabel ?? "incident"} autoImport={ws.settings.autoImportIssues ?? true} autoTravel={ws.settings.autoTravelOnMerge ?? true} />
            </section>
          )}
          {tab === "admission" && (
            <section className={sectionCls}>
              <Head title="Admission rules" sub="How strict time travel and pull request checks are." />
              <div className="px-6 py-2">
                {[["Runs per commit", "Time travel runs the draft this many times before and after the fix.", "3"], ["Drafts per incident", "Redrafts with failure feedback before giving up as Unproven.", "3"], ["Pull request runs", "Runs per relevant test on the head commit.", "3"], ["Fail before, pass after", "The admission rule itself.", "always on"], ["Mixed results", "How a check that passes some runs is shown.", "inconclusive"]].map(([k, d, v]) => (
                  <div key={k} className="flex flex-wrap items-center gap-x-5 gap-y-2.5 border-b border-line-soft py-4"><span className="flex flex-[1_1_280px] flex-col"><span className="font-semibold">{k}</span><span className="text-[12.5px] text-muted">{d}</span></span><span className="rounded-lg bg-ink px-3 py-1.5 font-mono text-[13px] font-semibold text-white">{v}</span></div>
                ))}
                <p className="m-0 py-4 text-[12.5px] text-muted">These values are fixed so every workspace’s “Proven” means the same thing.</p>
              </div>
            </section>
          )}
          {tab === "team" && (
            <section className={sectionCls}>
              <Head title="Team" sub="Members come from your GitHub organisation. Roles control who can override checks." />
              {members.map(({ user, role }) => (
                <div key={user.id} className="flex flex-wrap items-center gap-x-4 gap-y-2.5 border-b border-line-soft px-6 py-3.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-tint text-xs font-semibold">{(user.name ?? user.login)[0].toUpperCase()}</span>
                  <span className="flex flex-[1_1_200px] flex-col"><span className="font-semibold">{user.name ?? user.login}</span><span className="font-mono text-[12.5px] text-muted">@{user.login}</span></span>
                  <span className="rounded-md bg-neutral-tint px-2.5 py-1 text-[12.5px] font-semibold capitalize">{role}</span>
                </div>
              ))}
            </section>
          )}
          {tab === "tokens" && (
            <section className={sectionCls}>
              <Head title="API tokens" sub="For the CLI, the GitHub Action and the HTTP API." />
              <TokenForm />
              {tokens.map((t) => (
                <div key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-2.5 border-b border-line-soft px-6 py-3.5">
                  <span className="flex flex-[1_1_200px] flex-col"><span className="font-semibold">{t.name}</span><span className="font-mono text-xs text-muted">{t.prefix}</span></span>
                  <span className="text-[12.5px] text-muted">{t.lastUsedAt ? `used ${timeAgo(t.lastUsedAt).toLowerCase()}` : "never used"}</span>
                  <form action={revokeToken}><input type="hidden" name="tokenId" value={t.id} /><button type="submit" className="min-h-[38px] cursor-pointer rounded-lg border border-[#E8C4B0] bg-white px-3 font-semibold text-fail-deep">Revoke</button></form>
                </div>
              ))}
            </section>
          )}
          {tab === "billing" && (
            <section className={sectionCls}>
              <Head title={`Plan · ${ws.plan === "free" ? "Free" : ws.plan}`} sub="Unlimited public repositories on every plan."><ButtonLink href="/pricing">Compare plans</ButtonLink></Head>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))]">
                {[["Repositories", `${privateRepos}`, 0], ["Sandbox CPU-hours", `${hours(usage.sandboxCpuMs)} / ${hours(usage.allowanceMs)}`, (usage.sandboxCpuMs / usage.allowanceMs) * 100], ["Model drafts this month", `${usage.drafts}`, 0]].map(([k, v, p]) => (
                  <div key={String(k)} className="flex flex-col gap-2 border-r border-line-soft px-6 py-[18px]"><span className="text-[12.5px] text-muted">{k}</span><span className="font-mono text-xl font-semibold">{v}</span><div className="h-1.5 overflow-hidden rounded-[3px] bg-line-soft"><div className={`h-full ${Number(p) >= 100 ? "bg-fail" : "bg-pass"}`} style={{ width: `${Math.min(100, Number(p))}%` }} /></div></div>
                ))}
              </div>
            </section>
          )}
          {tab === "danger" && (
            <section className="overflow-hidden rounded-[14px] border border-[#E8C4B0] bg-card">
              <div className="flex flex-col gap-0.5 border-b border-[#F3DCCF] px-6 py-[18px]"><h2 className="m-0 text-lg font-semibold text-fail-deep">Danger zone</h2><span className="text-[13px] text-muted">Tests already merged into your repositories stay there.</span></div>
              <div className="px-6 py-2">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5 border-b border-line-soft py-4"><span className="flex flex-[1_1_280px] flex-col"><span className="font-semibold">Export everything</span><span className="text-[12.5px] text-muted">Incidents, evidence and run history as JSON.</span></span><a href="/api/v1/export" className="inline-flex min-h-[42px] items-center rounded-[9px] border border-line-strong bg-white px-4 font-semibold text-ink no-underline">Download export</a></div>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5 py-4"><span className="flex flex-[1_1_280px] flex-col"><span className="font-semibold">Delete workspace</span><span className="text-[12.5px] text-muted">Removes all incidents, evidence and settings. Contact support to confirm — it cannot be undone.</span></span><a href="mailto:[YOUR SUPPORT EMAIL]?subject=Delete%20workspace" className="inline-flex min-h-[42px] items-center rounded-[9px] bg-fail-deep px-4 font-semibold text-white no-underline">Request deletion</a></div>
              </div>
            </section>
          )}
        </div>
      </main>
    </>
  );
}
