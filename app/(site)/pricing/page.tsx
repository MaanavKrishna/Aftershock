import type { Metadata } from "next";
import { SiteHeader, SiteFooter, eyebrow } from "@/components/site/Chrome";
import { PricingPlans } from "@/components/site/PricingPlans";

export const metadata: Metadata = { title: "Pricing" };

const COMPARE = [["Setup", "None", "One workflow file"], ["Cost", "Counts sandbox CPU-hours", "Your Actions minutes"], ["Isolation", "Fresh microVM per run", "Your runner"], ["Secrets available", "None, ever", "Only ones you pass in"], ["Best for", "Getting started, private code you want isolated", "High PR volume, custom services"]];
const FAQ = [
  ["Does our source code leave GitHub?", "With your own runners, no. In our sandbox, the repository is cloned into a throwaway machine for the run and deleted with it. We store test results and logs, never your source."],
  ["What counts against sandbox time?", "Only CPU time spent running your tests. Waiting on installs over the network or on the model does not count."],
  ["What happens when we hit the sandbox limit?", "Pull request checks move to your GitHub Actions runners automatically. Nothing is skipped silently; the check says where it ran."],
  ["Can we bring our own model?", "Yes. Any OpenAI-compatible endpoint works, including self-hosted models. Model output is always a draft until git history proves it."],
  ["Is there a limit on incidents?", "No. Incidents, admitted tests and history are unlimited on every plan."],
];

export default function Pricing() {
  return (
    <div className="bg-site text-base leading-[1.55] text-ink">
      <SiteHeader current="/pricing" />
      <section className="mx-auto flex max-w-[1200px] flex-col gap-4 px-6 pb-6 pt-20">
        <span className={eyebrow}>Pricing</span>
        <h1 className="m-0 text-balance text-[clamp(38px,4.6vw,58px)] font-semibold leading-[1.04] tracking-[-0.035em]">Pay for proof, not for seats that watch.</h1>
        <p className="m-0 max-w-[600px] text-lg text-body">Run checks on your own GitHub Actions runners and the free plan never runs out. Use our sandbox when you want zero setup.</p>
      </section>
      <PricingPlans />
      <section className="border-y border-[#DCDDD8] bg-white">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-8 px-6 py-[72px]">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <h2 className="m-0 flex-[1_1_480px] text-[clamp(28px,3vw,38px)] font-semibold leading-[1.1] tracking-[-0.03em]">Where your checks run is your choice, per repository.</h2>
            <p className="m-0 flex-[0_1_400px] text-[15px] text-muted">Time travel always runs in our sandbox — it happens once per incident. Pull request checks can run in either place.</p>
          </div>
          <div className="overflow-x-auto rounded-xl border border-[#E7E8E3]">
            <table className="w-full min-w-[640px] border-collapse text-left text-[14.5px]">
              <thead><tr className="bg-[#FAFAF8] text-[12.5px] text-muted-2"><th className="px-5 py-3 font-normal"><span className="sr-only">Aspect</span></th><th className="px-5 py-3 font-normal">Aftershock sandbox</th><th className="px-5 py-3 font-normal">Your GitHub Actions</th></tr></thead>
              <tbody>{COMPARE.map(([k, a, b]) => <tr key={k} className="border-t border-line-soft"><th scope="row" className="px-5 py-3.5 font-semibold">{k}</th><td className="px-5 py-3.5 text-body">{a}</td><td className="px-5 py-3.5 text-body">{b}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      </section>
      <section className="mx-auto flex max-w-[1200px] flex-wrap gap-10 px-6 pb-24 pt-20">
        <h2 className="m-0 flex-[1_1_300px] text-[clamp(28px,3vw,38px)] font-semibold leading-[1.1] tracking-[-0.03em]">Questions teams ask first</h2>
        <div className="flex flex-[2_1_560px] flex-col">
          {FAQ.map(([q, a], i) => (
            <details key={q} open={i === 0} className="group border-t border-[#DCDDD8]">
              <summary className="flex min-h-[60px] cursor-pointer list-none items-center justify-between gap-4 py-4 text-[17px] font-semibold">{q}<span className="shrink-0 font-mono text-muted group-open:hidden">+</span><span className="hidden shrink-0 font-mono text-muted group-open:inline">−</span></summary>
              <p className="m-0 mb-5 max-w-[640px] text-body">{a}</p>
            </details>
          ))}
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
