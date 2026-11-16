import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { Verdict } from "@/components/ui/Verdict";
import { ArrowRight, Check } from "@/components/ui/icons";
import { ProofReplay } from "@/components/motion/ProofReplay";
import { Band, Container, Eyebrow, SectionHead } from "@/components/site/Section";
import { SeismicHero } from "@/components/site/SeismicHero";
import { Bento } from "@/components/site/Bento";
import { Faq } from "@/components/site/Faq";
import { PLAN_COPY, planLabel } from "@/components/site/plans";
import { SOURCES, SOURCE_IDS } from "@/lib/integrations/sources";
import { FRAMEWORK_IDS, frameworkDef } from "@/lib/runner/frameworks";
import { releases } from "@/lib/docs/changelog";

export const metadata: Metadata = { alternates: { canonical: "/" } };

const LOOP: { title: string; body: string; who: "people" | "model" | "runs" }[] = [
  { title: "An incident comes in", body: "From a labelled GitHub issue, a pasted postmortem, a form, or an alert from Sentry, PagerDuty, incident.io and others. Alerts wait until the pull request that fixes them merges.", who: "people" },
  { title: "A model drafts one test", body: "It reads the incident, the fix and your nearby tests, then writes a single regression test in your repository’s style. Until it is proven, it is only a draft.", who: "model" },
  { title: "Git history decides", body: "In a fresh sandbox the test must fail three times on the commit before the fix and pass three times on the fix. Anything else is rejected and redrafted, up to three times.", who: "runs" },
  { title: "It guards every pull request", body: "The proven test lands in your repository through a pull request. Every change that touches the same code runs it and gets one check: Recur, Safe, Inconclusive or Skipped.", who: "runs" },
];

const STORY: [string, string, string][] = [
  ["01", "An incident hits", "INC-12: a payment retry charged a customer twice. It arrives as a GitHub issue."],
  ["02", "A test is proven", "The drafted test fails three times on 3f2a1c9, the commit before the fix, and passes three times on aa86f56, the fix."],
  ["03", "A pull request is guarded", "Weeks later, #214 refactors payments. The test fails again, so the check blocks the merge."],
];

const MCP = `$ claude mcp add --transport http aftershock https://aftershock-mk.vercel.app/api/mcp \\
    --header "Authorization: Bearer as_live_…"

> check_change files=["app/services/payment_service.py"]

This change touches code from 1 past incident. Keep this behaviour:
- INC-12 Payment retry charged a customer twice:
  one order, one charge; the retry is rejected with 400
  (test tests/aftershock/test_inc_12_payment_retry.py)`;

const EVIDENCE = `{
  "payload": {
    "schema": "aftershock.evidence/v1",
    "incident": { "key": "INC-12", "status": "proven" },
    "proof": [{ "beforeTheFix": { "sha": "3f2a1c9…", "outcomes": ["failed","failed","failed"] },
                "onTheFix":     { "sha": "aa86f56…", "outcomes": ["passed","passed","passed"] } }],
    "guard": [{ "prNumber": 214, "verdict": "recur", "overridden": false }]
  },
  "signature": { "alg": "EdDSA", "kid": "as-3e330433736fb385", "canonicalization": "RFC8785", "value": "…" }
}`;

const HOSTILE: [string, string][] = [
  ["The model never decides", "Only real runs on real commits can mark a test proven or a change safe."],
  ["No secrets in runs", "Your environment variables, deploy keys and cloud credentials never reach sandboxed code."],
  ["Least privilege on GitHub", "Read-only clone tokens per repository. Tests arrive as pull requests you merge."],
];

const FAQ: [string, string][] = [
  ["Does a model decide whether a test is good?", "No. A model only drafts. A test is admitted when it fails on the commit before the fix and passes on the fix, three runs each. Mixed results are never green."],
  ["Where does our code run?", "In a fresh Firecracker microVM per run with no secrets and no network while tests run, or on your own GitHub Actions runners if you prefer."],
  ["What languages work?", "Python (pytest) and TypeScript (vitest, jest) today, with Go, Java and Kotlin (JUnit), Ruby (RSpec) and Playwright browser tests in Labs."],
  ["What if we stop using Aftershock?", "Your proven tests are ordinary files in your repository. They keep running in your CI without us."],
];

const chip = "inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-s1 px-3.5 text-callout text-fg-2";

function MoreLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="group inline-flex min-h-10 items-center gap-1.5 text-ui font-medium text-fg no-underline">
      {children}
      <ArrowRight size={16} className="text-fg-3 transition-transform duration-150 ease-fl group-hover:translate-x-0.5 group-hover:text-fg" />
    </Link>
  );
}

export default async function Home() {
  const latest = (await releases())[0]?.version;
  const jsonLd = [
    { "@context": "https://schema.org", "@type": "SoftwareApplication", name: "Aftershock", applicationCategory: "DeveloperApplication", operatingSystem: "Web", description: "Turns production incidents into regression tests proven against git history, and guards every pull request against them.", offers: { "@type": "Offer", price: "0", priceCurrency: "USD" } },
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
  ];
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <SeismicHero version={latest} />

      <Band id="proof" labelledBy="proof-h">
        <div className="grid items-start gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          <div className="lg:sticky lg:top-28">
            <SectionHead id="proof-h" size="display" eyebrow="One real proof, replayed" title="From outage to guard, in three beats." lede="Only one step trusts a model, and it only writes a draft. Real test runs against your own git history decide what stays." className="lg:mb-10" />
            <ol className="m-0 flex list-none flex-col gap-0 p-0">
              {STORY.map(([n, t, d]) => (
                <li key={n} className="grid grid-cols-[2.5rem_1fr] gap-x-3 border-t border-border-soft py-5">
                  <span className="pt-0.5 font-mono text-callout text-fg-3">{n}</span>
                  <span className="flex flex-col gap-1">
                    <span className="text-body font-semibold text-fg">{t}</span>
                    <span className="text-body text-fg-2">{d}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <ProofReplay />
        </div>
      </Band>

      <Band id="features" labelledBy="features-h">
        <SectionHead id="features-h" size="display" eyebrow="What it does" title="Everything the loop needs, and nothing it doesn’t." lede="Capture the incident, prove the test, guard the pull request, keep the memory honest." />
        <Bento />
      </Band>

      <Band id="how" tone="s1" labelledBy="how-h">
        <SectionHead id="how-h" size="display" eyebrow="How it works" title="One loop. Git history is the judge." />
        <ol className="m-0 grid list-none gap-4 p-0 md:grid-cols-2 lg:grid-cols-4">
          {LOOP.map((s, i) => (
            <li key={s.title} className="flex flex-col gap-4 rounded-card border border-border bg-canvas p-6">
              <div className="flex items-center justify-between gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-border-strong font-mono text-callout text-fg">{i + 1}</span>
                {s.who === "model" ? <Verdict kind="drafted" size="sm" label="Model, never trusted alone" /> : <span className="inline-flex min-h-5 items-center rounded-chip bg-s2 px-1.5 text-caption font-medium text-fg-2">{s.who === "people" ? "People or alerts" : "Real test runs"}</span>}
              </div>
              <h3 className="m-0 text-title-3 font-semibold text-fg">{s.title}</h3>
              <p className="m-0 text-body text-fg-2">{s.body}</p>
            </li>
          ))}
        </ol>
      </Band>

      <section aria-labelledby="works-h" className="border-t border-border-soft">
        <Container className="flex flex-col gap-8 py-16 lg:py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="works-h" className="m-0 text-title-2 font-semibold text-fg">Fits the tools you already have.</h2>
            <MoreLink href="/connect">All integrations</MoreLink>
          </div>
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="flex flex-col gap-3">
              <Eyebrow>Incidents come from</Eyebrow>
              <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                {["GitHub issues", "Postmortems", ...SOURCE_IDS.map((id) => SOURCES[id].label)].map((l) => <li key={l} className={chip}>{l}</li>)}
              </ul>
            </div>
            <div className="flex flex-col gap-3">
              <Eyebrow>Tests run with</Eyebrow>
              <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                {FRAMEWORK_IDS.map((id) => frameworkDef(id)).map((d) => (
                  <li key={d.id} className={chip}>
                    <span className="text-fg">{d.label}</span>
                    <span className="text-fg-3">{d.language}{d.flag ? " · Labs" : ""}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Container>
      </section>

      <Band id="agents" tone="s1" labelledBy="agents-h">
        <div className="grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="flex flex-col">
            <SectionHead id="agents-h" size="display" eyebrow="For coding agents" title="Your agents remember the outage, too." lede={<>Claude Code, Cursor and Copilot can ask Aftershock which past incidents a change touches before they commit, over MCP. Lessons also sync into <code className="font-mono text-[0.9em] text-fg">AGENTS.md</code>.</>} className="lg:mb-8" />
            <MoreLink href="/agents">Set up an agent</MoreLink>
          </div>
          <div className="min-w-0">
            <CodeBlock code={MCP} file="terminal" copy={false} mark={[6]} />
          </div>
        </div>
      </Band>

      <Band id="trust" labelledBy="trust-h">
        <SectionHead id="trust-h" size="display" eyebrow="Evidence and security" title="Built for the people who have to sign off." />
        <div className="grid gap-4 lg:grid-cols-2">
          <article className="flex min-w-0 flex-col gap-6 rounded-stage border border-border bg-s1 p-6 shadow-e1 sm:p-8">
            <div className="flex flex-col gap-2">
              <h3 className="m-0 text-title-2 font-semibold text-fg">Evidence an auditor can verify</h3>
              <p className="m-0 text-body text-fg-2">Each incident exports a bundle signed with Ed25519: the proof runs with their commits, every pull request the test guarded, and any overrides. SOC 2 and DORA both ask for exactly this.</p>
            </div>
            <CodeBlock code={EVIDENCE} file="aftershock-evidence-INC-12.json" copy={false} />
            <MoreLink href="/evidence">What is in a bundle</MoreLink>
          </article>
          <article className="flex min-w-0 flex-col gap-6 rounded-stage border border-border bg-s1 p-6 shadow-e1 sm:p-8">
            <div className="flex flex-col gap-2">
              <h3 className="m-0 text-title-2 font-semibold text-fg">We run your code, so we assume it’s hostile</h3>
              <p className="m-0 text-body text-fg-2">Every run is isolated, short-lived and secret-free by design. The full threat model is public.</p>
            </div>
            <ul className="m-0 flex list-none flex-col p-0">
              {HOSTILE.map(([t, d]) => (
                <li key={t} className="flex gap-3 border-t border-border-soft py-4">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-s2 text-fg-2" aria-hidden="true"><Check size={14} /></span>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-body font-medium text-fg">{t}</span>
                    <span className="text-callout text-fg-2">{d}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-auto"><MoreLink href="/security">How runs are isolated</MoreLink></div>
          </article>
        </div>
      </Band>

      <Band id="pricing" tone="s1" labelledBy="pricing-h">
        <SectionHead id="pricing-h" size="display" eyebrow="Pricing" title="Pay for proof, not for seats." lede="Run checks on your own GitHub Actions and the free plan never runs out." />
        <div className="grid gap-4 md:grid-cols-3">
          {PLAN_COPY.map((p) => (
            <Link key={p.id} href="/pricing" className={`group flex flex-col gap-4 rounded-card border bg-canvas p-6 no-underline transition-colors duration-150 hover:border-border-strong ${p.id === "team" ? "border-border-strong" : "border-border"}`}>
              <span className="flex items-center justify-between text-ui font-medium text-fg">
                {planLabel(p.id)}
                <ArrowRight size={16} className="text-fg-3 transition-transform duration-150 ease-fl group-hover:translate-x-0.5" />
              </span>
              <span className="text-display-2 font-semibold text-fg">{p.price}</span>
              <span className="text-callout text-fg-3">{p.per}</span>
              <span className="border-t border-border-soft pt-4 text-callout text-fg-2">{p.who}</span>
            </Link>
          ))}
        </div>
      </Band>

      <Band id="faq" labelledBy="faq-h">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionHead id="faq-h" size="display" title="Before you install" />
          <Faq items={FAQ} />
        </div>
      </Band>

      <section aria-labelledby="cta-h" className="border-t border-border-soft">
        <Container className="py-20 lg:py-30">
          <div className="relative flex flex-col items-center gap-6 overflow-hidden rounded-stage border border-border bg-s1 px-6 py-16 text-center shadow-e1 sm:py-20">
            <div aria-hidden="true" className="hero-spotlight pointer-events-none absolute inset-0" />
            <h2 id="cta-h" className="relative m-0 max-w-[20ch] text-balance text-display-2 font-semibold text-fg">Your last incident is the best place to start.</h2>
            <p className="relative m-0 max-w-[48ch] text-lede text-fg-2">Install the GitHub App and prove your first incident in about ten minutes.</p>
            <div className="relative flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
              <ButtonLink href="/signin" size="lg">Install on GitHub</ButtonLink>
              <ButtonLink href="/docs" size="lg" variant="secondary">Read the quickstart</ButtonLink>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
