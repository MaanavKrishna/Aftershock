import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/site/Chrome";

export const metadata: Metadata = { title: "Security — Aftershock" };

const FACTS = [["1 microVM", "per run, never reused"], ["0 secrets", "injected into a run"], ["45 min", "hard cap per sandbox"], ["Read-only", "GitHub contents access"]];
const LIFE = [["01", "Fresh machine", "A new Firecracker microVM boots from a clean image. No state from any other team or run."], ["02", "Shallow clone", "One commit is fetched with a short-lived, read-only installation token scoped to that repository."], ["03", "Locked network", "Package registries are reachable for install. After install, outbound network is cut before tests run."], ["04", "Run and record", "The test runs with a time limit. We keep exit codes, the test report and trimmed logs."], ["05", "Destroyed", "The machine is stopped and deleted. The clone, caches and any files the test wrote go with it."]];
const RULES = [["The model never decides", "A drafted test is only admitted when it fails before the fix and passes after, on real commits. A model cannot mark anything proven."], ["Least privilege on GitHub", "Contents read-only, checks and pull requests write. We cannot push to your default branch; admitted tests arrive as a PR you merge."], ["No secrets in runs", "Your environment variables, deploy keys and cloud credentials are never available to sandboxed code. Tests that need them belong on your runners."], ["Untrusted text stays data", "Incident text, postmortems and code are passed to the model as fenced data, never as instructions, so a malicious issue cannot steer it."], ["Signed webhooks only", "GitHub, Sentry and PagerDuty deliveries are verified by signature before anything is stored or run."], ["Your model, your keys", "Model keys live encrypted at rest and are never sent to the sandbox or shown again after you save them."]];
const DATA = [["Source code", "Never stored", "Lives only inside the sandbox for the run", true], ["Incident text", "Until you delete it", "It is the input your tests are built from", false], ["Admitted test code", "In your repository", "It is yours; we keep a copy for display", false], ["Run logs", "30 days", "Trimmed to the failing output, for debugging", false], ["Verdicts and evidence", "Until you delete the repository", "History of what was proven, and when", false], ["Model keys", "Encrypted, until removed", "To call the model you chose", false]] as const;

export default function Security() {
  return (
    <div className="bg-site text-base leading-[1.55] text-ink">
      <SiteHeader current="/security" />
      <section className="bg-ink text-on-dark">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-end gap-12 px-6 pb-20 pt-[88px]">
          <div className="flex flex-[1.3_1_520px] flex-col gap-[18px]">
            <span className="font-mono text-[13px] text-on-dark-muted">Security</span>
            <h1 className="m-0 text-balance text-[clamp(38px,4.6vw,58px)] font-semibold leading-[1.04] tracking-[-0.035em] text-white">We run your code. So we assume it’s hostile.</h1>
            <p className="m-0 max-w-[600px] text-lg text-on-dark-muted">Running a team’s tests means executing their code — and code a model drafted. Every run is isolated, short-lived and secret-free by design, not by policy.</p>
          </div>
          <div className="grid flex-[1_1_340px] grid-cols-2 gap-2.5">{FACTS.map(([v, k]) => <div key={v} className="flex flex-col gap-1 rounded-xl border border-ink-line bg-ink-2 p-[18px]"><span className="font-mono text-[22px] font-semibold text-white">{v}</span><span className="text-[13px] text-on-dark-muted">{k}</span></div>)}</div>
        </div>
      </section>
      <section className="mx-auto flex max-w-[1200px] flex-col gap-10 px-6 pb-[72px] pt-24">
        <div className="flex flex-wrap items-end justify-between gap-6"><h2 className="m-0 flex-[1_1_520px] text-[clamp(30px,3.4vw,44px)] font-semibold leading-[1.08] tracking-[-0.03em]">The life of one sandbox run.</h2><p className="m-0 flex-[0_1_400px] text-muted">Every time-travel attempt and every sandboxed pull request check follows the same path. Nothing survives the last step.</p></div>
        <ol className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(210px,100%),1fr))] gap-3 p-0">{LIFE.map(([n, t, d]) => <li key={n} className="flex min-h-[200px] flex-col gap-2.5 rounded-xl border border-[#DCDDD8] bg-white p-[22px]"><span className="font-mono text-[13px] text-muted">{n}</span><span className="text-lg font-semibold tracking-[-0.01em]">{t}</span><span className="text-[14.5px] text-muted">{d}</span></li>)}</ol>
      </section>
      <section className="border-y border-[#DCDDD8] bg-white">
        <div className="mx-auto grid max-w-[1200px] grid-cols-[repeat(auto-fit,minmax(min(340px,100%),1fr))] gap-x-14 gap-y-10 px-6 py-20">{RULES.map(([t, d]) => <div key={t} className="flex flex-col gap-2 border-t-2 border-ink pt-5"><h3 className="m-0 text-[19px] font-semibold tracking-[-0.01em]">{t}</h3><span className="text-[15px] text-body">{d}</span></div>)}</div>
      </section>
      <section className="mx-auto flex max-w-[1200px] flex-col gap-7 px-6 py-[88px]">
        <h2 className="m-0 text-[clamp(30px,3.4vw,44px)] font-semibold leading-[1.08] tracking-[-0.03em]">What we keep, and for how long.</h2>
        <div className="overflow-x-auto rounded-xl border border-[#DCDDD8] bg-white">
          <table className="w-full min-w-[680px] border-collapse text-left text-[14.5px]">
            <thead><tr className="border-b border-[#E7E8E3] bg-[#FAFAF8] text-[12.5px] text-muted-2"><th className="px-[22px] py-3 font-normal">Data</th><th className="px-[22px] py-3 font-normal">Kept</th><th className="px-[22px] py-3 font-normal">Why</th></tr></thead>
            <tbody>{DATA.map(([k, v, w, strong]) => <tr key={k} className="border-b border-line-soft"><th scope="row" className="px-[22px] py-[15px] font-semibold">{k}</th><td className={`px-[22px] py-[15px] ${strong ? "font-semibold" : "text-body"}`}>{v}</td><td className="px-[22px] py-[15px] text-muted">{w}</td></tr>)}</tbody>
          </table>
        </div>
        <p className="m-0 text-[13.5px] text-muted">Report a vulnerability to <a href="mailto:[YOUR SECURITY EMAIL]" className="text-pass">[YOUR SECURITY EMAIL]</a>.</p>
      </section>
      <section className="mx-auto max-w-[1200px] px-6 pb-24">
        <div className="flex flex-wrap items-center justify-between gap-7 rounded-2xl bg-ink p-[clamp(32px,5vw,60px)] text-white">
          <div className="flex flex-[1_1_460px] flex-col gap-2.5"><h2 className="m-0 text-[clamp(28px,3vw,40px)] font-semibold leading-[1.08] tracking-[-0.03em]">Prefer nothing leaves your network?</h2><p className="m-0 text-on-dark-muted">Switch a repository to “your runners”. Aftershock then only sees results.</p></div>
          <Link href="/docs#actions" className="inline-flex min-h-12 items-center rounded-lg bg-white px-[22px] font-semibold text-ink no-underline">Self-hosted runner guide</Link>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
