import type { Metadata } from "next";
import Link from "next/link";
import { currentScope } from "@/lib/auth/scope";
import { TopBar, Main, PageTitle } from "@/components/app/TopBar";
import { Card } from "@/components/ui/Card";
import { Pill, type Tone } from "@/components/ui/Pill";
import { ButtonLink } from "@/components/ui/Button";
import { incidentKey } from "@/lib/domain/ids";
import { renderLessons } from "@/lib/domain/lessons";
import { stamp, word } from "@/lib/format";

export const metadata: Metadata = { title: "Memory" };

const HEALTH: Record<string, [string, Tone]> = { healthy: ["Healthy", "pass"], flaky: ["Flaky", "dashed"], failing: ["Failing on main", "solidFail"] };

export default async function MemoryPage({ searchParams }: { searchParams: Promise<{ repo?: string; test?: string }> }) {
  const sp = await searchParams;
  const { scope } = await currentScope();
  const [ws, all, repos] = await Promise.all([scope.workspace(), scope.memory(), scope.repos()]);
  const prefix = ws?.incidentPrefix ?? "INC";
  const rows = all.filter((r) => !sp.repo || r.repo.name === sp.repo);
  const sel = rows.find((r) => r.test.id === sp.test) ?? rows[0];
  const q = (p: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    const repo = "repo" in p ? p.repo : sp.repo;
    if (repo) u.set("repo", repo);
    if (p.test) u.set("test", p.test);
    return `/memory${u.size ? `?${u}` : ""}`;
  };
  const lessons = renderLessons(all.map((r) => ({ key: incidentKey(prefix, r.incident.number), title: r.incident.title, files: r.incident.watchedFiles, expected: r.incident.expected, testPath: r.test.path })));
  const n = all.length;
  const failedNights = sel ? sel.test.nights.filter((x) => !x).length : 0;
  return (
    <>
      <TopBar title="Memory">
        <a href="/api/v1/lessons" download="LESSONS.md" className="inline-flex min-h-10 items-center gap-2 rounded-[9px] border border-line-strong bg-white px-3.5 text-[13.5px] font-semibold text-ink no-underline">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v11" /><path d="m7 10 5 5 5-5" /><path d="M5 20h14" /></svg>
          Export LESSONS.md
        </a>
      </TopBar>
      <Main>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex-[1_1_480px]"><PageTitle title={n === 0 ? "No lessons yet." : `${word(n)} ${n === 1 ? "lesson" : "lessons"} your codebase can’t forget.`} sub="Every test here failed before its fix and passed after. Each night they run again on your default branch to stay honest." /></div>
          <nav aria-label="Repository" className="flex flex-wrap gap-1.5">
            {[["", "All repos"], ...repos.map((r) => [r.name, r.name])].map(([id, label]) => (
              <Link key={label} href={q({ repo: id || undefined })} aria-current={(sp.repo ?? "") === id ? "page" : undefined} className={`inline-flex min-h-9 items-center rounded-full px-3 text-[13px] no-underline ${(sp.repo ?? "") === id ? "border border-ink bg-ink text-white" : "border border-line-strong bg-white text-body"}`}>{label}</Link>
            ))}
          </nav>
        </div>
        {n === 0 ? (
          <Card className="flex flex-col items-center gap-3.5 px-7 py-9 text-center">
            <span className="text-lg font-semibold">No lessons yet</span>
            <span className="max-w-[320px] text-muted">Import one fixed incident. Aftershock will travel back through your history and prove a test for it.</span>
            <ButtonLink href="/incidents/new">Import an incident</ButtonLink>
          </Card>
        ) : (
          <div className="flex flex-wrap items-start gap-4">
            <Card className="min-w-0 flex-[1.4_1_520px]">
              {rows.map((r) => {
                const [h, tone] = HEALTH[r.test.health];
                const on = sel?.test.id === r.test.id;
                return (
                  <Link key={r.test.id} href={q({ test: r.test.id })} aria-current={on ? "true" : undefined} className={`flex min-h-16 items-center gap-3.5 border-b border-line-soft px-5 py-3 text-inherit no-underline ${on ? "bg-pass-wash shadow-[inset_3px_0_0_#0E141B]" : "hover:bg-[#FAFAF8]"}`}>
                    <span className="w-14 shrink-0 font-mono text-xs text-muted">{incidentKey(prefix, r.incident.number)}</span>
                    <span className="flex min-w-0 flex-1 flex-col"><span className="truncate font-semibold">{r.incident.title}</span><span className="truncate font-mono text-xs text-muted-2">{r.test.fn}</span></span>
                    <span className="flex shrink-0 flex-col items-end gap-0.5"><Pill tone={tone}>{h}</Pill><span className="font-mono text-[11.5px] text-muted-2">{r.guarded} PRs</span></span>
                  </Link>
                );
              })}
            </Card>
            {sel && (
              <aside className="flex min-w-0 flex-[1_1_380px] flex-col gap-4">
                <Card>
                  <div className="flex flex-col gap-1.5 border-b border-[#EDEEE9] px-[22px] py-[18px]">
                    <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs text-muted">{incidentKey(prefix, sel.incident.number)} · {sel.repo.name}</span><Pill tone={HEALTH[sel.test.health][1]}>{HEALTH[sel.test.health][0]}</Pill></div>
                    <span className="text-lg font-semibold tracking-[-0.015em]">{sel.incident.title}</span>
                    <span className="break-all font-mono text-xs text-muted">{sel.test.path}</span>
                  </div>
                  <div className="grid grid-cols-3 border-b border-[#EDEEE9]">
                    <div className="border-r border-line-soft px-[18px] py-3.5"><div className="text-xs text-muted">Guarded</div><div className="font-mono text-[22px] font-semibold">{sel.guarded}</div></div>
                    <div className="border-r border-line-soft px-[18px] py-3.5"><div className="text-xs text-muted">Blocked</div><div className={`font-mono text-[22px] font-semibold ${sel.blocked ? "text-fail" : ""}`}>{sel.blocked}</div></div>
                    <div className="px-[18px] py-3.5"><div className="text-xs text-muted">Proven</div><div className="font-mono text-[22px] font-semibold">{stamp(sel.test.provenAt).split(",")[0]}</div></div>
                  </div>
                  <div className="flex flex-col gap-2 px-[22px] py-4">
                    <span className="text-[12.5px] text-muted">Nightly on main · last {sel.test.nights.length || 14} nights</span>
                    <div className="flex gap-[3px]" role="img" aria-label={`${failedNights} failing nights`}>{(sel.test.nights.length ? sel.test.nights : Array(14).fill(null)).map((ok: boolean | null, i: number) => <span key={i} className={`h-[18px] flex-1 rounded-[3px] ${ok === null ? "bg-line" : ok ? "bg-pass" : "bg-fail"}`} />)}</div>
                    <span className="text-[12.5px] text-muted">{sel.test.health === "failing" ? "Started failing on main. Something merged around the check — open the incident." : sel.test.health === "flaky" ? `${failedNights} failure${failedNights === 1 ? "" : "s"} in ${sel.test.nights.length} nights. Flaky tests are reported, never silently retried to green.` : "Passing every night on the default branch."}</span>
                  </div>
                  <div className="flex flex-col gap-2 border-t border-[#EDEEE9] px-[22px] py-4">
                    <span className="text-[12.5px] text-muted">Runs when a pull request touches</span>
                    <div className="flex flex-wrap gap-1.5">{sel.incident.watchedFiles.map((w) => <span key={w} className="rounded-md bg-paper px-2 py-1 font-mono text-xs">{w}</span>)}</div>
                  </div>
                  <div className="flex flex-wrap gap-2 border-t border-[#EDEEE9] px-[22px] py-3.5">
                    <ButtonLink href={`/incidents/${sel.incident.number}`} className="min-h-10 text-[13px]">Open incident</ButtonLink>
                    <ButtonLink href={`/incidents/${sel.incident.number}/travel`} variant="secondary" className="min-h-10 text-[13px]">See the proof</ButtonLink>
                  </div>
                </Card>
                <Card dark>
                  <div className="flex flex-col gap-1 border-b border-[#222C38] px-5 py-4"><span className="font-semibold">LESSONS.md for coding agents</span><span className="text-[12.5px] text-on-dark-muted">Commit it, and AI assistants in your editor read your incident history before they change risky code.</span></div>
                  <pre className="m-0 max-h-[320px] overflow-auto px-5 py-4 font-mono text-xs leading-[1.7] text-[#C9D1DA]">{lessons}</pre>
                </Card>
              </aside>
            )}
          </div>
        )}
      </Main>
    </>
  );
}
