import type { Metadata } from "next";
import { DsLink } from "@/components/ds/Button";
import { Band, SectionHead } from "@/components/site/Section";
import { CostCalculator } from "@/components/site/CostCalculator";
import { PLANS } from "@/lib/billing/plans";

export const metadata: Metadata = { title: "Pricing", description: "Free for open source and small teams. Team is free during the beta, then $20 per active committer a month.", alternates: { canonical: "/pricing" } };

const PLAN_COPY = [
  { id: "free", price: "$0", per: "forever", who: "Open source and teams up to five", cta: ["Install on GitHub", "/signin"], features: ["Unlimited public repositories", `Up to ${PLANS.free.maxCommitters} active committers on private repositories`, "Unlimited incidents and proven tests", "Checks on your own GitHub Actions, unlimited", `${PLANS.free.baseHours} sandbox CPU-hours a month`, "Community support on GitHub"] },
  { id: "team", price: "$20", per: "per active committer a month, free during the beta", who: "Product teams shipping every day", cta: ["Join the free beta", "/signin"], features: ["Everything in Free", "Unlimited active committers", `${PLANS.team.hoursPerCommitter} sandbox CPU-hours a month per committer, pooled`, "Every alert source, notifications and the MCP server", "Suggested fixes on failing checks", "Email support"] },
  { id: "business", price: "Custom", per: "invoiced", who: "Regulated and larger organisations", cta: ["Talk to us", "mailto:maanavkrishna@gmail.com?subject=Aftershock%20Business"], features: ["Everything in Team", "Signed audit evidence for every incident", "Help importing past incidents", "Priority support", "Invoiced billing"] },
] as const;

const FAQ: [string, string][] = [
  ["Who counts as an active committer?", "Anyone who opened a pull request that Aftershock checked in the last 30 days, on a private repository. Reviewers, viewers and bots (Dependabot, Renovate, Aftershock itself) are free."],
  ["What counts against sandbox time?", "Active CPU time in the sandbox: installing dependencies and running tests. Waiting on the network or on the model does not count. Runs on your own GitHub Actions never count."],
  ["What happens at the sandbox limit?", "Repositories that already report from GitHub Actions switch to it automatically. Others show an inconclusive check that says why; nothing is skipped silently."],
  ["When does billing start?", "Not before v0.3. Team stays free during the beta and you will get 30 days’ notice before any charge."],
  ["Can we bring our own model?", "Yes. Vercel AI Gateway or any OpenAI-compatible endpoint, including self-hosted models. A model’s output is always a draft until git history proves it."],
];

export default function Pricing() {
  return (
    <>
      <section className="mx-auto max-w-[1240px] px-4 pb-14 pt-16 sm:px-6 sm:pt-20">
        <h1 className="m-0 max-w-[18ch] text-balance font-display text-d1 font-semibold tracking-[-0.03em] text-fg">Pay for proof, not for seats that watch.</h1>
        <p className="mt-6 max-w-[58ch] text-lede text-fg-2">Run checks on your own GitHub Actions and the free plan never runs out. Use the hosted sandbox when you want no setup at all.</p>
      </section>
      <section className="mx-auto max-w-[1240px] px-4 pb-20 sm:px-6">
        <div className="grid gap-4 lg:grid-cols-3">
          {PLAN_COPY.map((p) => {
            const featured = p.id === "team";
            return (
              <article key={p.id} className={`flex flex-col gap-6 rounded-panel border p-7 ${featured ? "border-signal bg-raised shadow-lift" : "border-rule bg-raised"}`}>
                <div className="flex flex-col gap-1">
                  <h2 className="m-0 font-display text-[22px] font-semibold text-fg">{PLANS[p.id].label}</h2>
                  <p className="m-0 text-[14px] text-fg-3">{p.who}</p>
                </div>
                <div className="flex flex-col">
                  <span className="font-display text-[44px] font-semibold leading-none tracking-[-0.03em] text-fg">{p.price}</span>
                  <span className="mt-2 text-[14px] text-fg-3">{p.per}</span>
                </div>
                <DsLink href={p.cta[1]} variant={featured ? "primary" : "secondary"}>{p.cta[0]}</DsLink>
                <ul className="m-0 flex list-none flex-col p-0 text-[14.5px] text-fg-2">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2.5 border-t border-rule py-2.5"><span aria-hidden="true" className="text-signal">✓</span>{f}</li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </section>
      <Band tone="raised">
        <SectionHead title="Is it worth it for us?" lede="Compare the price with what repeat incidents already cost you." />
        <CostCalculator />
      </Band>
      <Band>
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionHead title="Questions teams ask first" />
          <div className="flex flex-col">
            {FAQ.map(([q, a], i) => (
              <details key={q} open={i === 0} className="group border-t border-rule">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 text-[17px] font-semibold text-fg [&::-webkit-details-marker]:hidden">{q}<span aria-hidden="true" className="text-fg-3 transition-transform group-open:rotate-45">+</span></summary>
                <p className="m-0 mb-5 max-w-[64ch] text-fg-2">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </Band>
    </>
  );
}
