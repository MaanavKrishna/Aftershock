import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";
import { Check } from "@/components/ui/icons";
import { Band, Container, PageHero, SectionHead } from "@/components/site/Section";
import { Faq } from "@/components/site/Faq";
import { PLAN_COPY, planLabel } from "@/components/site/plans";
import { CostCalculator } from "@/components/site/CostCalculator";

export const metadata: Metadata = { title: "Pricing", description: "Free for open source and small teams. Team is free during the beta, then $20 per active committer a month.", alternates: { canonical: "/pricing" } };

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
      <PageHero eyebrow="Pricing" title="Pay for proof, not for seats that watch." lede="Run checks on your own GitHub Actions and the free plan never runs out. Use the hosted sandbox when you want no setup at all." />
      <section aria-label="Plans">
        <Container className="pb-20 lg:pb-30">
          <div className="grid gap-4 lg:grid-cols-3">
            {PLAN_COPY.map((p) => {
              const featured = p.id === "team";
              return (
                <article key={p.id} className={`relative flex flex-col gap-6 rounded-stage border p-7 shadow-e1 ${featured ? "border-border-strong bg-s1 shadow-e2" : "border-border bg-s1"}`}>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="m-0 text-title-2 font-semibold text-fg">{planLabel(p.id)}</h2>
                      {featured && <span className="inline-flex min-h-6 items-center rounded-full border border-border-strong px-2.5 text-caption font-medium text-fg-2">Free during the beta</span>}
                    </div>
                    <p className="m-0 text-callout text-fg-3">{p.who}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className="text-display-2 font-semibold tabular-nums text-fg">{p.price}</span>
                    <span className="text-callout text-fg-3">{p.per}</span>
                  </div>
                  <ButtonLink href={p.cta[1]} size="lg" variant={featured ? "primary" : "secondary"}>{p.cta[0]}</ButtonLink>
                  <ul className="m-0 flex list-none flex-col gap-3 border-t border-border-soft p-0 pt-6 text-ui text-fg-2">
                    {p.features.map((f) => (
                      <li key={f} className="flex gap-2.5"><Check size={16} className="mt-0.5 shrink-0 text-fg-3" />{f}</li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        </Container>
      </section>
      <Band tone="s1" labelledBy="worth-h">
        <SectionHead id="worth-h" title="Is it worth it for us?" lede="Compare the price with what repeat incidents already cost you." />
        <CostCalculator />
      </Band>
      <Band labelledBy="faq-h">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionHead id="faq-h" title="Questions teams ask first" />
          <Faq items={FAQ} />
        </div>
      </Band>
    </>
  );
}
