"use client";
import { useState } from "react";
import Link from "next/link";

const FREE = ["Unlimited public repositories", "1 private repository", "Unlimited incidents and admitted tests", "Checks on your own GitHub Actions — unlimited", "5 sandbox CPU-hours a month", "Community support"];
const TEAM = ["Unlimited private repositories", "Sentry and PagerDuty intake", "[N] sandbox CPU-hours per committer", "Suggested fixes on failing checks", "Required checks and team roles", "Email support, next business day"];
const ENT = ["Self-hosted runners only mode", "SSO and SCIM", "Audit log export", "Bring your own model endpoint", "Data residency options", "Named support contact"];

function Check({ dark }: { dark?: boolean }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={dark ? "#7AA7FF" : "#1D4ED8"} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-[3px] shrink-0"><path d="m5 12 5 5 9-10" /></svg>;
}

export function PricingPlans() {
  const [yearly, setYearly] = useState(false);
  const seg = (on: boolean) => `min-h-[38px] cursor-pointer rounded-[7px] border-0 px-4 text-sm font-semibold ${on ? "bg-ink text-white" : "bg-transparent text-body"}`;
  return (
    <>
      <div className="mx-auto flex max-w-[1200px] justify-end px-6 pb-6">
        <div role="group" aria-label="Billing period" className="flex rounded-[10px] border border-[#DCDDD8] bg-white p-1">
          <button type="button" onClick={() => setYearly(false)} aria-pressed={!yearly} className={seg(!yearly)}>Monthly</button>
          <button type="button" onClick={() => setYearly(true)} aria-pressed={yearly} className={seg(yearly)}>Yearly</button>
        </div>
      </div>
      <section className="mx-auto max-w-[1200px] px-6 pb-[72px]">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(320px,100%),1fr))] items-stretch gap-3.5">
          <article className="flex flex-col gap-5 rounded-[14px] border border-[#DCDDD8] bg-white p-7">
            <div className="flex flex-col gap-1.5"><span className="text-lg font-semibold">Free</span><span className="text-sm text-muted">Open source and small teams</span></div>
            <div className="flex items-baseline gap-1.5"><span className="text-[44px] font-semibold tracking-[-0.03em]">$0</span><span className="text-sm text-muted">forever</span></div>
            <Link href="/signin" className="flex min-h-[46px] items-center justify-center rounded-[9px] border border-field font-semibold text-ink no-underline">Connect GitHub</Link>
            <div className="flex flex-col text-[14.5px] text-body">{FREE.map((f) => <div key={f} className="flex gap-2.5 border-t border-line-soft py-[9px]"><Check /><span>{f}</span></div>)}</div>
          </article>
          <article className="flex flex-col gap-5 rounded-[14px] bg-ink p-7 text-on-dark shadow-[0_30px_60px_-30px_rgba(14,20,27,0.45)]">
            <div className="flex items-start justify-between gap-3"><div className="flex flex-col gap-1.5"><span className="text-lg font-semibold text-white">Team</span><span className="text-sm text-on-dark-muted">Product teams shipping daily</span></div><span className="rounded-md bg-pass-dark px-2 py-1 font-mono text-[11.5px] font-semibold text-ink">MOST TEAMS</span></div>
            <div className="flex items-baseline gap-1.5"><span className="text-[44px] font-semibold tracking-[-0.03em] text-white">{yearly ? "[YEARLY PRICE]" : "[MONTHLY PRICE]"}</span><span className="text-sm text-on-dark-muted">per active committer / {yearly ? "year" : "month"}</span></div>
            <Link href="/signin" className="flex min-h-[46px] items-center justify-center rounded-[9px] bg-site font-semibold text-ink no-underline">Start a 14-day trial</Link>
            <div className="flex flex-col text-[14.5px] text-[#C9D1DA]">{TEAM.map((f) => <div key={f} className="flex gap-2.5 border-t border-ink-line py-[9px]"><Check dark /><span>{f}</span></div>)}</div>
          </article>
          <article className="flex flex-col gap-5 rounded-[14px] border border-[#DCDDD8] bg-white p-7">
            <div className="flex flex-col gap-1.5"><span className="text-lg font-semibold">Enterprise</span><span className="text-sm text-muted">Regulated and large organisations</span></div>
            <div className="flex items-baseline gap-1.5"><span className="text-[44px] font-semibold tracking-[-0.03em]">Custom</span></div>
            <a href="mailto:[YOUR SALES EMAIL]" className="flex min-h-[46px] items-center justify-center rounded-[9px] border border-field font-semibold text-ink no-underline">Talk to us</a>
            <div className="flex flex-col text-[14.5px] text-body">{ENT.map((f) => <div key={f} className="flex gap-2.5 border-t border-line-soft py-[9px]"><Check /><span>{f}</span></div>)}</div>
          </article>
        </div>
        <p className="m-0 mt-5 text-[13px] text-muted">An active committer is anyone who opened a checked pull request in the billing period. Reviewers, viewers and bots are free.</p>
      </section>
    </>
  );
}
