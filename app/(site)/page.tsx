import Link from "next/link";
import { SiteHeader, SiteFooter, eyebrow, h2 } from "@/components/site/Chrome";
import { HeroCard } from "@/components/site/HeroCard";
import { LogoMark } from "@/components/ui/Logo";

const STEPS = [
  { n: "01 · Capture", t: "Bring the incident in", d: "Label a GitHub issue, paste a postmortem, fill a form, or let a Sentry or PagerDuty alert open it. Alerts wait in “Awaiting fix” until the fix PR merges.", tag: "Human or alert", kind: "human" },
  { n: "02 · Draft", t: "Write the reproduction", d: "A model reads the incident, the fix diff and your existing tests, then drafts one pytest or vitest test in your repo’s own style.", tag: "AI · unproven", kind: "ai" },
  { n: "03 · Time travel", t: "Prove it against history", d: "In a throwaway sandbox, the test must fail on the commit before the fix and pass on the fix — three times each. Anything else is rejected and redrafted.", tag: "Execution", kind: "exec" },
  { n: "04 · Guard", t: "Protect every pull request", d: "The proven test lands in your repo as a normal PR. From then on, every change that touches the same code runs it and gets a check.", tag: "Execution + review", kind: "exec" },
];

const TOOLS = [["repo", "GitHub"], ["alerts", "Sentry"], ["alerts", "PagerDuty"], ["py", "pytest"], ["ts", "vitest"], ["ts", "jest"], ["ci", "GitHub Actions"], ["ai", "Any OpenAI-compatible model"]];

const TEST = `# Aftershock · INC-12 “Payment retry charged a customer twice”
# Proven: fails on 3f2a1c9 (3/3) · passes on aa86f56 (3/3)

def test_retry_after_lost_ack_does_not_double_charge(client, pending_order):
    first = client.post("/payments", json={"order_id": pending_order.id})
    assert first.status_code == 201

    # The acknowledgement is lost. The client retries the same request.
    retry = client.post("/payments", json={"order_id": pending_order.id})

    assert retry.status_code == 400
    assert payment_count(pending_order.id) == 1`;

export default function Home() {
  return (
    <div className="bg-site text-base leading-[1.55] text-ink">
      <SiteHeader />

      <section id="top" className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-14 px-6 pb-[88px] pt-[72px]">
        <div className="flex min-w-0 flex-[1_1_440px] flex-col gap-7">
          <div className="flex items-center gap-2.5 font-mono text-[13px] text-muted"><span className="h-2 w-2 rounded-full bg-fail" />Incident to test, proven by git history</div>
          <h1 className="m-0 text-balance text-[clamp(40px,5vw,64px)] font-semibold leading-[1.04] tracking-[-0.035em]">Every incident becomes a test. Git history proves it.</h1>
          <p className="m-0 max-w-[560px] text-[19px] leading-[1.6] text-body">Aftershock reads the incident and the commit that fixed it, writes a reproduction test, and keeps it only if it fails before the fix and passes after. Then it runs on every pull request, so the same outage can’t ship twice.</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/signin" className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-ink px-[22px] text-[15px] font-semibold text-white no-underline">
              Connect GitHub — free
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg>
            </Link>
            <Link href="#proof" className="inline-flex min-h-12 items-center rounded-lg border border-field bg-white px-[22px] text-[15px] font-semibold text-ink no-underline">See a proven test</Link>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-[#DCDDD8] pt-5 font-mono text-[13px] text-muted">
            <span>AI drafts</span><span className="text-[#A0A5AC]">→</span><span className="font-semibold text-ink">Git history proves</span><span className="text-[#A0A5AC]">→</span><span>Humans merge</span>
          </div>
        </div>
        <HeroCard />
      </section>

      <section className="border-y border-[#DCDDD8] bg-white">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-start gap-8 px-6 py-12">
          {[["01", "It breaks in production.", "A lost acknowledgement, a retry, a second charge.", false], ["02", "Someone ships a fix and a postmortem.", "The fix is in git. The lesson is in a doc nobody reruns.", false], ["03", "A refactor brings it back.", "Nothing in CI knew why that guard was there.", true]].map(([n, t, d, hot]) => (
            <div key={String(n)} className="flex flex-[1_1_220px] flex-col gap-2">
              <span className={`font-mono text-[13px] ${hot ? "text-fail" : "text-muted"}`}>{n}</span>
              <div className="text-lg font-semibold">{t}</div>
              <p className="m-0 text-[15px] text-muted">{d}</p>
            </div>
          ))}
          <div className="flex-[1.3_1_280px] rounded-[10px] bg-ink px-[22px] py-5 text-[17px] font-medium leading-normal text-white">Aftershock turns 02 into a test the moment the fix merges — so 03 fails in review, not in production.</div>
        </div>
      </section>

      <section id="how" className="mx-auto max-w-[1200px] px-6 pb-24 pt-[104px]">
        <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
          <div className="flex flex-[1_1_520px] flex-col gap-3.5"><span className={eyebrow}>How it works</span><h2 className={h2}>Four steps. Only one of them trusts a model, and it never gets the last word.</h2></div>
          <div className="flex flex-[0_1_380px] flex-wrap gap-x-4 gap-y-2 text-[13px] text-body">
            <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-[2px] border-[1.5px] border-dashed border-muted" />AI draft</span>
            <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-[2px] bg-field" />Human decision</span>
            <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-[2px] bg-ink" />Execution</span>
          </div>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(250px,100%),1fr))] gap-3">
          {STEPS.map((s) => (
            <article key={s.n} className={`flex min-h-[270px] flex-col gap-3.5 rounded-xl bg-white p-6 ${s.kind === "ai" ? "border-[1.5px] border-dashed border-[#9AA1A9]" : "border border-[#DCDDD8]"}`}>
              <span className="font-mono text-[13px] text-muted">{s.n}</span>
              <h3 className="m-0 text-xl font-semibold tracking-[-0.01em]">{s.t}</h3>
              <p className="m-0 flex-1 text-[14.5px] text-muted">{s.d}</p>
              <span className={`self-start rounded-[5px] px-[9px] py-1 text-xs font-semibold ${s.kind === "ai" ? "border border-dashed border-muted text-body" : s.kind === "exec" ? "bg-ink text-white" : "bg-[#E7E8E3] text-body"}`}>{s.tag}</span>
            </article>
          ))}
        </div>
      </section>

      <section id="proof" className="bg-ink text-on-dark">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-12 px-6 py-[104px]">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="flex flex-[1_1_520px] flex-col gap-3.5"><span className="font-mono text-[13px] text-on-dark-muted">The output</span><h2 className={`${h2} text-white`}>A real test file. Not a dashboard you have to trust.</h2></div>
            <p className="m-0 flex-[0_1_420px] text-base text-on-dark-muted">Each admitted test is plain code in your repository, with its proof in the header. Remove Aftershock tomorrow and your CI keeps running it.</p>
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="flex min-w-0 flex-[1.4_1_520px] flex-col overflow-hidden rounded-xl border border-ink-line bg-ink-2">
              <div className="flex flex-wrap justify-between gap-2 border-b border-ink-line px-5 py-3.5 font-mono text-[13px]"><span>tests/aftershock/test_inc_12_payment_retry.py</span><span className="text-pass-dark">admitted</span></div>
              <pre className="m-0 overflow-x-auto px-5 py-[18px] font-mono text-[13px] leading-[1.75] text-[#C9D1DA]">{TEST}</pre>
            </div>
            <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-4">
              <div className="flex flex-col gap-3.5 rounded-xl border border-ink-line bg-ink-2 p-[22px]">
                <div className="font-mono text-[13px] text-on-dark-muted">Admission · 3 runs per commit</div>
                <div className="flex flex-col gap-2"><div className="flex justify-between text-sm"><span>Before the fix</span><span className="font-mono text-fail-dark">3 / 3 fail</span></div><div className="flex gap-1.5">{[0, 1, 2].map((i) => <span key={i} className="flex h-[30px] flex-1 items-center justify-center rounded-md border-[1.5px] border-fail-dark text-fail-dark" aria-hidden="true">✕</span>)}</div></div>
                <div className="flex flex-col gap-2"><div className="flex justify-between text-sm"><span>On the fix</span><span className="font-mono text-pass-dark">3 / 3 pass</span></div><div className="flex gap-1.5">{[0, 1, 2].map((i) => <span key={i} className="flex h-[30px] flex-1 items-center justify-center rounded-md bg-pass text-white" aria-hidden="true">✓</span>)}</div></div>
                <div className="border-t border-ink-line pt-3 text-[13px] text-[#8792A0]">A test that passes before the fix proves nothing. A flaky one gets marked unproven, never green.</div>
              </div>
              <div className="flex flex-col gap-2.5 rounded-xl border border-ink-line bg-ink-2 p-[22px] font-mono text-[13px]">
                <div className="text-on-dark-muted">Lands in your repo</div>
                <div>.aftershock/</div><div className="pl-4 text-[#C9D1DA]">incidents/INC-12.yaml</div><div className="pl-4 text-[#C9D1DA]">config.yaml</div>
                <div>tests/aftershock/</div><div className="pl-4 text-[#C9D1DA]">test_inc_12_payment_retry.py</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="pr" className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-14 px-6 pb-24 pt-[104px]">
        <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-4">
          <span className={eyebrow}>Pull requests</span>
          <h2 className={h2}>The warning lands where the code is reviewed.</h2>
          <p className="m-0 text-[16.5px] text-muted">Aftershock picks the incidents a change could reopen, runs only those tests, and posts one check and one comment. Unrelated incidents are skipped with a reason, so the run stays fast.</p>
          <div className="flex flex-col gap-2.5 pt-2">
            {["Runs in our sandbox, or on your own GitHub Actions runners", "Blocking or advisory — your branch rules decide", "One click to ask for a suggested fix, which faces the same test", "Finds the epicenter: the commit and PR that first introduced the bug"].map((t) => (
              <div key={t} className="flex items-baseline gap-3"><span className="w-[22px] shrink-0 font-mono text-[13px] text-pass">→</span><span>{t}</span></div>
            ))}
          </div>
        </div>
        <article aria-label="Example pull request comment" className="min-w-0 flex-[1.2_1_520px] overflow-hidden rounded-[14px] border border-[#DCDDD8] bg-white shadow-[0_24px_48px_-32px_rgba(14,20,27,0.35)]">
          <div className="flex items-center gap-3 border-b border-[#E7E8E3] bg-[#FAFAF8] px-[18px] py-3.5">
            <LogoMark />
            <span className="text-sm"><span className="font-semibold">aftershock</span> <span className="rounded-[10px] border border-field px-1.5 py-px text-xs text-muted">bot</span> <span className="text-muted-2">commented on #214</span></span>
          </div>
          <div className="flex flex-col gap-4 px-[22px] py-5">
            <div className="flex flex-wrap items-center gap-2.5"><span className="rounded-md bg-fail px-2.5 py-1 font-mono text-xs font-semibold text-white">1 INCIDENT WOULD RECUR</span><span className="text-[13px] text-muted">3 relevant · 9 skipped</span></div>
            <div className="text-base font-semibold tracking-[-0.01em]">This change reopens INC-12: payment retry charged a customer twice.</div>
            <div className="overflow-hidden rounded-[10px] border border-[#E7E8E3] text-[13.5px]">
              <div className="grid grid-cols-[70px_1fr_90px] gap-3 border-b border-[#E7E8E3] bg-[#FAFAF8] px-3.5 py-2.5 text-xs text-muted-2"><span>Incident</span><span>Proven test</span><span>Result</span></div>
              {[["INC-12", "test_retry_after_lost_ack…", "0/3 pass", true], ["INC-07", "test_order_paid_only_after_capture", "3/3 pass", false], ["INC-02", "test_invoice_sent_once_per_order", "3/3 pass", false]].map(([k, t, r, bad]) => (
                <div key={String(k)} className="grid grid-cols-[70px_1fr_90px] items-center gap-3 border-b border-line-soft px-3.5 py-[11px]"><span className="font-mono">{k}</span><span className="truncate font-mono text-[12.5px]">{t}</span><span className={`font-semibold ${bad ? "text-fail" : "text-pass"}`}>{r}</span></div>
              ))}
            </div>
            <div className="rounded-lg bg-fail-tint px-3.5 py-3 font-mono text-[12.5px] text-body">AssertionError: retry.status_code == 201, expected 400 · payment rows: 2</div>
          </div>
        </article>
      </section>

      <section className="border-y border-[#DCDDD8] bg-white">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-7 px-6 py-14">
          <div className="flex flex-[1_1_300px] flex-col gap-1.5"><span className="text-xl font-semibold tracking-[-0.01em]">Fits the tools you already run.</span><span className="text-[14.5px] text-muted">No new test framework, no agent on your servers.</span></div>
          <div className="flex flex-[2_1_560px] flex-wrap gap-2">
            {TOOLS.map(([k, n]) => <span key={n} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#DCDDD8] bg-[#FAFAF8] px-3.5 text-sm font-medium"><span className="font-mono text-[11.5px] text-muted-2">{k}</span>{n}</span>)}
          </div>
        </div>
      </section>

      <section id="scope" className="mx-auto flex max-w-[1200px] flex-col gap-10 px-6 py-24">
        <div className="flex max-w-[720px] flex-col gap-3.5"><span className={eyebrow}>Honest scope</span><h2 className={h2}>What it proves today. What it won’t pretend to.</h2></div>
        <div className="flex flex-wrap gap-4">
          <div className="flex flex-[1_1_400px] flex-col gap-3.5 rounded-xl border border-[#DCDDD8] bg-white p-[26px]">
            <div className="flex items-center gap-2.5 font-semibold"><span className="h-2.5 w-2.5 rounded-[2px] bg-pass" />Works today</div>
            <div className="flex flex-col text-[15px] text-body">{["Python with pytest; TypeScript with vitest or jest", "Any GitHub repository the app is installed on", "Incidents from issues, postmortems, forms, Sentry and PagerDuty", "Fail-before, pass-after admission on real commits", "Pull request checks and comments, sandboxed or on your runners"].map((t, i, a) => <div key={t} className={`py-2.5 ${i < a.length - 1 ? "border-b border-[#ECEDE9]" : ""}`}>{t}</div>)}</div>
          </div>
          <div className="flex flex-[1_1_400px] flex-col gap-3.5 rounded-xl border-[1.5px] border-dashed border-[#9AA1A9] p-[26px]">
            <div className="flex items-center gap-2.5 font-semibold"><span className="h-2.5 w-2.5 rounded-[2px] border-[1.5px] border-dashed border-muted" />Not yet</div>
            <div className="flex flex-col text-[15px] text-body">{["GitLab and Bitbucket", "Incidents that need live third-party services to reproduce", "Load, latency and multi-service failures", "Incidents with no fix commit — they wait, unproven"].map((t, i, a) => <div key={t} className={`py-2.5 ${i < a.length - 1 ? "border-b border-[#ECEDE9]" : ""}`}>{t}</div>)}</div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1200px] px-6 pb-24">
        <div className="flex flex-wrap items-end justify-between gap-8 rounded-2xl bg-ink p-[clamp(36px,6vw,72px)] text-white">
          <div className="flex flex-[1_1_480px] flex-col gap-3.5"><h2 className="m-0 text-[clamp(32px,4vw,52px)] font-semibold leading-[1.05] tracking-[-0.035em]">Your last incident is your best test.</h2><p className="m-0 text-[17px] text-on-dark-muted">Connect a repository, import one fixed incident, and watch it travel back through your history.</p></div>
          <div className="flex flex-wrap gap-3">
            <Link href="/signin" className="inline-flex min-h-12 items-center rounded-lg bg-white px-[22px] font-semibold text-ink no-underline">Connect GitHub — free</Link>
            <Link href="/docs" className="inline-flex min-h-12 items-center rounded-lg border border-[#3A4654] px-[22px] font-semibold text-white no-underline">Read the docs</Link>
          </div>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
