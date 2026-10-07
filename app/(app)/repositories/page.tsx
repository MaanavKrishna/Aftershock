import { currentScope } from "@/lib/auth/scope";
import { TopBar, Main, PageTitle } from "@/components/app/TopBar";
import { Card, CardHead } from "@/components/ui/Card";
import { setRepoSetting } from "../actions";
import { hours, timeAgo } from "@/lib/format";
import type { RepositoryRow } from "@/lib/db/schema";

function Segment({ repo, field, label, options, value }: { repo: RepositoryRow; field: string; label: string; options: [string, string][]; value: string }) {
  return (
    <form action={setRepoSetting} role="group" aria-label={`${label} for ${repo.name}`} className="inline-flex justify-self-start rounded-lg border border-line bg-[#FAFAF8] p-[3px]">
      <input type="hidden" name="repoId" value={repo.id} />
      <input type="hidden" name="field" value={field} />
      {options.map(([v, l]) => (
        <button key={v} type="submit" name="value" value={v} aria-pressed={value === v} className={`min-h-8 cursor-pointer rounded-md px-3 text-[12.5px] font-semibold ${value === v ? "bg-ink text-white" : "bg-transparent text-muted"}`}>{l}</button>
      ))}
    </form>
  );
}

export default async function Repositories({ searchParams }: { searchParams: Promise<{ repo?: string }> }) {
  const { repo: selName } = await searchParams;
  const { scope } = await currentScope();
  const [repos, mem, usage, byRepo, ws] = await Promise.all([scope.repos(), scope.memoryCountByRepo(), scope.usage(), scope.usageByRepo(), scope.workspace()]);
  const sel = repos.find((r) => r.name === selName) ?? repos[0];
  const cols = "grid-cols-[minmax(0,1.8fr)_1fr_1.5fr_1.4fr_90px]";
  const parts = [...byRepo.checks.map((c) => ({ name: c.repo, ms: c.ms })), { name: "time travel", ms: byRepo.travelMs }].filter((p) => p.ms > 0);
  const partTotal = parts.reduce((a, p) => a + p.ms, 0) || 1;
  const COLORS = ["bg-ink", "bg-pass", "bg-[#9AA1A9]", "bg-fail"];
  const installUrl = process.env.GITHUB_APP_SLUG ? `https://github.com/apps/${process.env.GITHUB_APP_SLUG}/installations/new` : null;
  return (
    <>
      <TopBar title="Repositories">
        {installUrl && <a href={installUrl} className="inline-flex min-h-10 items-center rounded-[9px] border border-line-strong bg-white px-3.5 text-[13.5px] font-semibold text-ink no-underline">Add on GitHub</a>}
      </TopBar>
      <Main>
        <PageTitle title="Where checks run, and how hard they push back." sub="Each repository picks a runner and whether a recurrence blocks the merge." />
        <Card>
          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
              <div className={`grid ${cols} gap-4 border-b border-[#EDEEE9] bg-[#FAFAF8] px-[22px] py-[11px] text-xs text-muted-2`}><span>Repository</span><span>Tests</span><span>Runner</span><span>On recurrence</span><span>Memory</span></div>
              {repos.map((r) => (
                <div key={r.id} className={`grid ${cols} items-center gap-4 border-b border-line-soft px-[22px] py-3.5`}>
                  <a href={`/repositories?repo=${r.name}`} className="flex min-w-0 flex-col text-inherit no-underline"><span className="font-mono font-semibold">{r.name}</span><span className="text-xs text-muted-2">{r.language} · last check {timeAgo(r.lastCheckAt).toLowerCase()}</span></a>
                  <span className="font-mono text-[12.5px] text-body">{r.framework}</span>
                  <Segment repo={r} field="runner" label="Runner" value={r.runner} options={[["sandbox", "Sandbox"], ["actions", "Actions"]]} />
                  <Segment repo={r} field="checkMode" label="Check mode" value={r.checkMode} options={[["blocking", "Block"], ["advisory", "Warn"]]} />
                  <span className="font-mono text-[13px]">{mem[r.id] ?? 0} tests</span>
                </div>
              ))}
              {repos.length === 0 && <div className="px-[22px] py-10 text-center text-muted">No repositories yet. Install the GitHub App to add some.</div>}
            </div>
          </div>
        </Card>
        <div className="flex flex-wrap items-start gap-4">
          <Card className="min-w-0 flex-[1.3_1_480px]">
            <CardHead sub="Active CPU only. Resets on the 1st.">Sandbox usage this month</CardHead>
            <div className="flex flex-col gap-4 px-[22px] py-5">
              <div className="flex items-baseline justify-between"><span className="font-mono text-[30px] font-semibold tracking-[-0.02em]">{hours(usage.sandboxCpuMs)}</span><span className="text-muted">of {hours(usage.allowanceMs)}</span></div>
              <div className="flex h-3.5 overflow-hidden rounded bg-line-soft" role="img" aria-label={`${hours(usage.sandboxCpuMs)} used of ${hours(usage.allowanceMs)}`}>
                {parts.map((p, i) => <span key={p.name} className={COLORS[i % 4]} style={{ width: `${(p.ms / partTotal) * Math.min(100, (usage.sandboxCpuMs / usage.allowanceMs) * 100)}%` }} />)}
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-[13px]">
                {parts.map((p, i) => <span key={p.name} className="inline-flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-[2px] ${COLORS[i % 4]}`} /><span className="font-mono text-[12.5px]">{p.name}</span><span className="text-muted">{Math.round((p.ms / partTotal) * 100)}%</span></span>)}
              </div>
              <div className="rounded-[10px] bg-pass-wash px-3.5 py-3 text-[13px] text-pass-deep">At the limit, pull request checks move to GitHub Actions for repositories that have the workflow installed. Time travel waits until the reset.</div>
            </div>
          </Card>
          {sel && (
            <Card dark className="min-w-0 flex-[1_1_380px]">
              <CardHead dark sub="Commit this file to the default branch to keep these settings with your code. It overrides the settings above.">.aftershock/config.yaml · {sel.name}</CardHead>
              <pre className="m-0 overflow-x-auto px-[22px] py-4 font-mono text-[12.5px] leading-[1.75] text-[#C9D1DA]">{`framework: ${sel.framework}\nrunner: ${sel.runner}\ninstall: ${sel.installCmd}\ntest_dir: ${sel.testDir}\ncheck:\n  mode: ${sel.checkMode}\n  runs: 3\nincidents:\n  issue_label: ${ws?.settings.issueLabel ?? "incident"}`}</pre>
            </Card>
          )}
        </div>
      </Main>
    </>
  );
}
