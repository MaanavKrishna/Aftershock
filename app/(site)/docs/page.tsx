import type { Metadata } from "next";
import Link from "next/link";
import { LogoMark } from "@/components/ui/Logo";
import { CopyButton } from "@/components/site/CopyButton";

export const metadata: Metadata = { title: "Docs — Aftershock" };

const TOC = [
  ["GETTING STARTED", [["#quickstart", "Quickstart"], ["#concepts", "Core concepts"], ["#verdicts", "Verdicts"]]],
  ["CONFIGURE", [["#config", "config.yaml"], ["#cli", "Command line"], ["#actions", "GitHub Actions"]]],
  ["REFERENCE", [["#api", "HTTP API"], ["#rules", "Rules that never bend"], ["#limits", "Current limits"], ["/security", "Security"]]],
] as const;

const QUICK = [
  ["Sign in with GitHub and install the app", "Pick the repositories Aftershock may read. It asks for contents read, checks and pull requests write."],
  ["Import an incident", "Choose a closed issue labelled incident, paste a postmortem, or fill the form. Point at the fix commit or PR."],
  ["Watch time travel", "Aftershock drafts a test and runs it before and after the fix. If it fails then passes, it is admitted."],
  ["Merge the bot PR", "The proven test lands under tests/aftershock/. From now on, pull requests that touch that code get a check."],
];
const CONCEPTS = [["Incident", "A failure you never want back: trigger, what happened, what should have happened."], ["Fix commit", "The commit that resolved it. Its parent is “before the fix”."], ["Draft test", "A test the model wrote. It proves nothing until time travel runs."], ["Time travel", "Running the draft on the parent and on the fix, three times each, in a sandbox."], ["Memory", "Your admitted tests, each tied to its incident and its proof."], ["Guard", "The pull request check that runs relevant memory tests on every change."], ["Epicenter", "The commit and PR that first introduced the bug, found by bisecting with the proven test."], ["Retro-check", "When a test is admitted, it runs against every open PR at once."]];
const VERDICTS = [["Proven", "time travel", "Failed 3/3 before the fix and passed 3/3 on it. Admitted to memory.", "bg-pass text-white"], ["Unproven", "time travel", "Mixed results, an environment error, or every redraft failed. Nothing is admitted.", "border border-dashed border-muted-2 text-body"], ["Rejected", "time travel", "Passed before the fix, so it does not reproduce the incident.", "bg-neutral-tint text-body"], ["Safe", "pull request", "Every relevant memory test passed on the head commit.", "bg-pass-tint text-pass-deep"], ["Recur", "pull request", "A memory test failed on every run. The change reopens that incident.", "bg-fail text-white"], ["Inconclusive", "pull request", "Mixed results or the environment failed. Reported, never shown as green.", "border border-dashed border-muted-2 text-body"]];
const CONFIG = `framework: pytest            # pytest | vitest | jest
runner: sandbox              # sandbox | actions
install: pip install -r requirements.txt
test_dir: tests/aftershock
check:
  mode: blocking             # blocking | advisory
  runs: 3
incidents:
  issue_label: incident`;
const CLI = `npx aftershock verify INC-12 --local    # time travel one incident with Docker
npx aftershock check --base main --head HEAD --local
npx aftershock check --pr 214           # report a PR check from CI`;
const ACTION = `name: Aftershock
on: [pull_request]
jobs:
  guard:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - run: npx aftershock check --pr \${{ github.event.number }} --base \${{ github.event.pull_request.base.sha }} --head \${{ github.sha }}
        env:
          AFTERSHOCK_TOKEN: \${{ secrets.AFTERSHOCK_TOKEN }}
          AFTERSHOCK_URL: https://[your-domain]`;
const API = [["GET", "/api/v1/incidents", "List incidents and their status"], ["POST", "/api/v1/incidents", "Create an incident from text"], ["POST", "/api/v1/incidents/:number/verify", "Start time travel"], ["GET", "/api/v1/runs/:id/evidence", "One time-travel run with its evidence"], ["GET", "/api/v1/memory", "Admitted tests"], ["GET", "/api/v1/lessons", "LESSONS.md for coding agents"], ["POST", "/api/v1/checks/report", "Report a check run from your own runner"]];
const RULES = ["A model never marks anything proven or safe. Only test runs do.", "A test that passes before the fix is rejected, however good it looks.", "Mixed results are inconclusive — never green.", "Aftershock never pushes to your default branch. Tests arrive as pull requests.", "Sandboxed runs never receive your secrets."];

const h2 = "m-0 text-[28px] font-semibold tracking-[-0.02em]";
const pre = "m-0 overflow-x-auto rounded-xl bg-ink px-[18px] py-4 font-mono text-[13px] leading-[1.75] text-[#C9D1DA]";

export default function Docs() {
  return (
    <div className="bg-site text-[15.5px] leading-[1.65] text-ink">
      <header className="border-b border-[#DCDDD8]">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-6 gap-y-4 px-6 py-3.5">
          <Link href="/" className="flex min-h-11 items-center gap-2.5 text-lg font-bold tracking-[-0.02em] text-ink no-underline"><LogoMark size={28} />Aftershock <span className="font-medium text-muted">Docs</span></Link>
          <span className="flex-1" />
          <Link href="/signin" className="inline-flex min-h-[42px] items-center rounded-lg bg-ink px-4 text-sm font-semibold text-white no-underline">Open app</Link>
        </div>
      </header>
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-start gap-12 px-6">
        <nav aria-label="Docs sections" className="flex max-w-full flex-[1_1_220px] flex-col gap-[22px] py-9 text-sm">
          {TOC.map(([group, items]) => (
            <div key={group} className="flex flex-col gap-0.5">
              <span className="px-2.5 pb-1.5 font-mono text-[11.5px] tracking-[0.05em] text-muted-2">{group}</span>
              {items.map(([href, label]) => <Link key={href} href={href} className="flex min-h-9 items-center rounded-[7px] px-2.5 text-body no-underline hover:bg-white">{label}</Link>)}
            </div>
          ))}
        </nav>
        <main className="flex min-w-0 max-w-[820px] flex-[999_1_640px] flex-col gap-16 pb-24 pt-10">
          <section id="quickstart" className="flex flex-col gap-[18px]">
            <span className="font-mono text-[13px] text-muted">Getting started</span>
            <h1 className="m-0 text-[42px] font-semibold leading-[1.08] tracking-[-0.03em]">Quickstart</h1>
            <p className="m-0 text-[17px] text-body">From install to your first proven test in about ten minutes. You need a GitHub repository with pytest, vitest or jest, and one incident that already has a fix commit.</p>
            <ol className="m-0 mt-2 flex list-none flex-col gap-3.5 p-0">
              {QUICK.map(([t, d], i) => (
                <li key={t} className="flex gap-4 rounded-xl border border-[#DCDDD8] bg-white px-5 py-[18px]">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink font-mono text-[13px] font-semibold text-white">{i + 1}</span>
                  <span className="flex flex-col gap-0.5"><span className="font-semibold">{t}</span><span className="text-[14.5px] text-muted">{d}</span></span>
                </li>
              ))}
            </ol>
          </section>
          <section id="concepts" className="flex flex-col gap-[18px]">
            <h2 className={h2}>Core concepts</h2>
            <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] gap-2.5">
              {CONCEPTS.map(([t, d]) => <div key={t} className="flex flex-col gap-1.5 rounded-xl border border-[#DCDDD8] bg-white p-[18px]"><dt className="font-mono text-[13px] font-semibold">{t}</dt><dd className="m-0 text-[14.5px] text-body">{d}</dd></div>)}
            </dl>
          </section>
          <section id="verdicts" className="flex flex-col gap-[18px]">
            <h2 className={h2}>Verdicts</h2>
            <p className="m-0 text-body">Two kinds of verdict exist. Time travel decides whether a test is admitted. Pull request checks decide whether a change reopens an incident.</p>
            <div className="overflow-hidden rounded-xl border border-[#DCDDD8] bg-white">
              {VERDICTS.map(([n, k, d, cls]) => <div key={n} className="flex flex-wrap items-baseline gap-x-[18px] gap-y-2 border-b border-line-soft px-5 py-[15px]"><span className={`w-24 rounded-md px-[9px] py-[3px] text-center font-mono text-xs font-semibold ${cls}`}>{n}</span><span className="w-[110px] font-mono text-xs text-muted-2">{k}</span><span className="flex-[1_1_320px] text-[14.5px] text-body">{d}</span></div>)}
            </div>
          </section>
          <section id="config" className="flex flex-col gap-[18px]">
            <h2 className={h2}>.aftershock/config.yaml</h2>
            <p className="m-0 text-body">Optional. Without it, Aftershock detects the framework and uses the sandbox. The file is read from the default branch.</p>
            <div className="overflow-hidden rounded-xl bg-ink">
              <div className="flex items-center justify-between border-b border-[#222C38] px-4 py-2.5 font-mono text-xs text-[#7D8896]"><span>yaml</span><CopyButton text={CONFIG} /></div>
              <pre className="m-0 overflow-x-auto px-[18px] py-4 font-mono text-[13px] leading-[1.75] text-[#C9D1DA]">{CONFIG}</pre>
            </div>
          </section>
          <section id="cli" className="flex flex-col gap-[18px]">
            <h2 className={h2}>Command line</h2>
            <p className="m-0 text-body">The same runner the sandbox uses. Run it locally with Docker, or in CI.</p>
            <pre className={pre}>{CLI}</pre>
            <div className="overflow-hidden rounded-xl border border-[#DCDDD8] bg-white text-sm">{[["0", "Safe, or proven"], ["1", "Recur — an incident would come back"], ["2", "Inconclusive or unproven"]].map(([c, d]) => <div key={c} className="flex gap-[18px] border-b border-line-soft px-[18px] py-3"><span className="w-[60px] font-mono font-semibold">exit {c}</span><span className="text-body">{d}</span></div>)}</div>
          </section>
          <section id="actions" className="flex flex-col gap-[18px]">
            <h2 className={h2}>Run checks on your GitHub Actions</h2>
            <p className="m-0 text-body">Set the repository’s runner to “Actions” in Aftershock, create an API token in Settings, then add this workflow. Results report back to the same check.</p>
            <pre className={pre}>{ACTION}</pre>
          </section>
          <section id="api" className="flex flex-col gap-[18px]">
            <h2 className={h2}>HTTP API</h2>
            <p className="m-0 text-body">Authenticate with <code className="font-mono text-[14px]">Authorization: Bearer as_live_…</code> using a workspace token from Settings. All responses are JSON unless noted.</p>
            <div className="overflow-hidden rounded-xl border border-[#DCDDD8] bg-white">{API.map(([m, p, d]) => <div key={p + m} className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1.5 border-b border-line-soft px-[18px] py-[13px]"><span className={`w-[52px] font-mono text-xs font-semibold ${m === "GET" ? "text-pass" : "text-fail-deep"}`}>{m}</span><span className="flex-[0_1_300px] font-mono text-[13px]">{p}</span><span className="flex-[1_1_240px] text-sm text-muted">{d}</span></div>)}</div>
          </section>
          <section id="rules" className="flex flex-col gap-[18px]">
            <h2 className={h2}>Rules that never bend</h2>
            <ol className="m-0 list-none rounded-xl bg-ink px-[22px] py-2 text-on-dark">{RULES.map((r, i) => <li key={r} className="flex gap-3.5 border-b border-[#222C38] py-3.5 last:border-0"><span className="shrink-0 font-mono text-pass-dark">{String(i + 1).padStart(2, "0")}</span><span>{r}</span></li>)}</ol>
          </section>
          <section id="limits" className="flex flex-col gap-3.5">
            <h2 className={h2}>Current limits</h2>
            <ul className="m-0 flex flex-col gap-1.5 pl-5 text-body">
              <li>GitHub only. GitLab and Bitbucket are not supported yet.</li>
              <li>Python 3.10–3.13 with pytest; Node 20+ with vitest or jest.</li>
              <li>Tests that need live third-party services cannot be proven in the sandbox. Use your runners and fixtures.</li>
              <li>Incidents without a fix commit stay in “Awaiting fix” and are never proven by guesswork.</li>
            </ul>
          </section>
        </main>
      </div>
    </div>
  );
}
