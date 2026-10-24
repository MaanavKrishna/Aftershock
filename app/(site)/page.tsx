import type { Metadata } from "next";
import Link from "next/link";
import { DsLink } from "@/components/ds/Button";
import { CodeBlock } from "@/components/ds/CodeBlock";
import { ProofReplay } from "@/components/motion/ProofReplay";
import { Band, SectionHead } from "@/components/site/Section";
import { CostCalculator } from "@/components/site/CostCalculator";
import { SOURCES, SOURCE_IDS } from "@/lib/integrations/sources";
import { FRAMEWORK_IDS, frameworkDef } from "@/lib/runner/frameworks";

export const metadata: Metadata = { alternates: { canonical: "/" } };

const LOOP: { title: string; body: string; who: "people" | "model" | "runs" }[] = [
  { title: "An incident comes in", body: "From a labelled GitHub issue, a pasted postmortem, a form, or an alert from Sentry, PagerDuty, incident.io and others. Alerts wait until the pull request that fixes them merges.", who: "people" },
  { title: "A model drafts one test", body: "It reads the incident, the fix and your nearby tests, then writes a single regression test in your repository's style. Until it is proven, it is only a draft.", who: "model" },
  { title: "Git history decides", body: "In a fresh sandbox the test must fail three times on the commit before the fix and pass three times on the fix. Anything else is rejected and redrafted, up to three times.", who: "runs" },
  { title: "It guards every pull request", body: "The proven test lands in your repository through a pull request. Every change that touches the same code runs it and gets one check: Recur, Safe, Inconclusive or Skipped.", who: "runs" },
];
const WHO = { people: ["People or alerts", "border-fg-3"], model: ["Model, never trusted alone", "border-dashed border-violet"], runs: ["Real test runs", "border-signal"] } as const;

type Cell = "yes" | "no" | "partly";
const COMPARE: [string, Cell, Cell, Cell, Cell][] = [
  ["Test is proven against git history (fails before the fix, passes on it)", "yes", "no", "no", "no"],
  ["Runs on every relevant pull request", "yes", "partly", "yes", "no"],
  ["Plain test file you keep if you leave", "yes", "yes", "no", "no"],
  ["Finds the commit that introduced the bug", "yes", "no", "no", "no"],
  ["Signed evidence for audits", "yes", "no", "no", "partly"],
];
const MARK: Record<Cell, [string, string, string]> = { yes: ["✓", "Yes", "text-signal"], no: ["✕", "No", "text-fg-3"], partly: ["◐", "Partly", "text-amber"] };

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

const FAQ: [string, string][] = [
  ["Does a model decide whether a test is good?", "No. A model only drafts. A test is admitted when it fails on the commit before the fix and passes on the fix, three runs each. Mixed results are never green."],
  ["Where does our code run?", "In a fresh Firecracker microVM per run with no secrets and no network while tests run, or on your own GitHub Actions runners if you prefer."],
  ["What languages work?", "Python (pytest) and TypeScript (vitest, jest) today, with Go, Java and Kotlin (JUnit), Ruby (RSpec) and Playwright browser tests in Labs."],
  ["What if we stop using Aftershock?", "Your proven tests are ordinary files in your repository. They keep running in your CI without us."],
];

export default function Home() {
  const jsonLd = [
    { "@context": "https://schema.org", "@type": "SoftwareApplication", name: "Aftershock", applicationCategory: "DeveloperApplication", operatingSystem: "Web", description: "Turns production incidents into regression tests proven against git history, and guards every pull request against them.", offers: { "@type": "Offer", price: "0", priceCurrency: "USD" } },
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
  ];
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <section className="mx-auto grid max-w-[1240px] items-center gap-12 px-4 pb-20 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[1fr_1.05fr]">
        <div className="flex flex-col gap-7">
          <h1 className="m-0 text-balance font-display text-d1 font-semibold tracking-[-0.028em] text-fg">Every incident becomes a test. Git history proves it.</h1>
          <p className="m-0 max-w-[56ch] text-lede text-fg-2">Aftershock reads an incident and the commit that fixed it, drafts a regression test, and keeps it only if it fails before the fix and passes on it. From then on it runs on every pull request, so the same outage can’t ship twice.</p>
          <div className="flex flex-wrap gap-3">
            <DsLink href="/signin">Install on GitHub</DsLink>
            <DsLink href="/product" variant="secondary">How a proof works</DsLink>
          </div>
          <p className="m-0 text-[14px] text-fg-3">Free for open source and teams up to five committers. Apache 2.0.</p>
        </div>
        <ProofReplay />
      </section>

      <Band id="how" tone="raised">
        <SectionHead id="how-h" title="One loop, and only one step trusts a model." lede="The model writes the first draft. Real test runs against your own git history decide what stays." />
        <ol className="relative m-0 grid list-none gap-0 p-0 md:grid-cols-4 md:gap-6">
          {LOOP.map((s, i) => (
            <li key={s.title} className="relative flex gap-4 pb-8 md:flex-col md:pb-0">
              <span className="flex flex-col items-center md:flex-row">
                <span className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 bg-raised font-code text-[13px] text-fg ${WHO[s.who][1]}`} aria-hidden="true">{i + 1}</span>
                {i < LOOP.length - 1 && <span className="w-px flex-1 bg-rule-strong md:h-px md:w-auto md:flex-1" aria-hidden="true" />}
              </span>
              <span className="flex flex-col gap-2 md:pr-2">
                <h3 className="m-0 font-display text-d3 font-semibold tracking-[-0.015em] text-fg">{s.title}</h3>
                <p className="m-0 text-[15px] text-fg-2">{s.body}</p>
                <span className="text-[13px] text-fg-3">{WHO[s.who][0]}</span>
              </span>
            </li>
          ))}
        </ol>
      </Band>

      <Band id="compare">
        <SectionHead title="Proof, not opinion." lede="AI test generators write tests nobody checked against history. Review bots comment. Incident tools stop at the postmortem. Aftershock is the part that makes the lesson executable." />
        <div className="overflow-x-auto rounded-panel border border-rule">
          <table className="w-full min-w-[720px] border-collapse text-left text-[14.5px]">
            <caption className="sr-only">How Aftershock compares with other kinds of tools</caption>
            <thead>
              <tr className="bg-raised text-[13px] text-fg-3">
                <th scope="col" className="px-5 py-3.5 font-medium">What you get</th>
                <th scope="col" className="px-5 py-3.5 font-semibold text-fg">Aftershock</th>
                <th scope="col" className="px-5 py-3.5 font-medium">AI test generators</th>
                <th scope="col" className="px-5 py-3.5 font-medium">Code review bots</th>
                <th scope="col" className="px-5 py-3.5 font-medium">Incident platforms</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE.map(([what, ...cells]) => (
                <tr key={what} className="border-t border-rule">
                  <th scope="row" className="max-w-[340px] px-5 py-4 font-medium text-fg">{what}</th>
                  {cells.map((c, j) => (
                    <td key={j} className={`px-5 py-4 ${MARK[c][2]}`}><span aria-hidden="true">{MARK[c][0]}</span> <span className={j === 0 ? "font-semibold" : ""}>{MARK[c][1]}</span></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-[13px] text-fg-3"><Link href="/compare" className="text-fg-2">Named comparisons, with sources</Link></p>
      </Band>

      <Band id="cost" tone="raised">
        <SectionHead title="What does a repeat incident cost you?" lede="The same bug coming back is the most avoidable outage there is. Here is the cost, using your own numbers." />
        <CostCalculator />
      </Band>

      <Band id="works-with">
        <SectionHead title="Fits the tools you already have." />
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <h3 className="m-0 mb-3 text-[15px] font-semibold text-fg">Incidents come from</h3>
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {["GitHub issues", "Postmortems", ...SOURCE_IDS.map((id) => SOURCES[id].label)].map((l) => <li key={l} className="rounded-chip border border-rule px-3 py-1.5 text-[14px] text-fg-2">{l}</li>)}
            </ul>
          </div>
          <div>
            <h3 className="m-0 mb-3 text-[15px] font-semibold text-fg">Tests run with</h3>
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {FRAMEWORK_IDS.map((id) => frameworkDef(id)).map((d) => <li key={d.id} className="rounded-chip border border-rule px-3 py-1.5 text-[14px] text-fg-2">{d.label} <span className="text-fg-3">· {d.language}{d.flag ? " (Labs)" : ""}</span></li>)}
            </ul>
          </div>
        </div>
      </Band>

      <Band id="agents" tone="sunken">
        <div className="grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <SectionHead title="Your coding agents remember the outage, too." lede={<>Claude Code, Cursor and Copilot can ask Aftershock which past incidents a change touches before they commit, over MCP. Lessons also sync into <code className="font-code text-[0.9em]">AGENTS.md</code>.</>} />
          <CodeBlock code={MCP} file="terminal" copy={false} mark={[6]} />
        </div>
        <DsLink href="/agents" variant="secondary">Set up an agent</DsLink>
      </Band>

      <Band id="evidence">
        <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <CodeBlock code={EVIDENCE} file="aftershock-evidence-INC-12.json" copy={false} />
          <div>
            <SectionHead title="Evidence an auditor can verify." lede="Each incident exports a bundle signed with Ed25519: the proof runs with their commits, every pull request the test guarded, and any overrides. SOC 2 and DORA both ask for exactly this." />
            <DsLink href="/evidence" variant="secondary">See what is in a bundle</DsLink>
          </div>
        </div>
      </Band>

      <Band id="faq" tone="raised">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionHead title="Before you install" />
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

      <section className="border-t border-rule">
        <div className="mx-auto flex max-w-[1240px] flex-col items-start gap-6 px-4 py-20 sm:px-6">
          <h2 className="m-0 max-w-[20ch] text-balance font-display text-d2 font-semibold tracking-[-0.03em] text-fg">Your last incident is the best place to start.</h2>
          <div className="flex flex-wrap gap-3">
            <DsLink href="/signin">Install on GitHub</DsLink>
            <DsLink href="/docs" variant="secondary">Read the quickstart</DsLink>
          </div>
        </div>
      </section>
    </>
  );
}
