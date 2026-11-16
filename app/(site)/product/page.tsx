import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";
import { Container, PageHero } from "@/components/site/Section";
import { Verdict } from "@/components/ui/Verdict";
import { CodeBlock } from "@/components/ui/CodeBlock";

export const metadata: Metadata = { title: "Product", description: "Time travel, pull request guard, risk, Epicenter, still-guarding re-proofs, test strength, insights and Ask Aftershock.", alternates: { canonical: "/product" } };

function Feature({ title, body, children, id, index }: { title: string; body: React.ReactNode; children: React.ReactNode; id: string; index: number }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className={`border-t border-border-soft ${index % 2 ? "bg-s1" : "bg-canvas"}`}>
      <Container className="grid items-center gap-10 py-20 lg:grid-cols-2 lg:gap-16 lg:py-28">
        <div className={`flex flex-col gap-4 ${index % 2 ? "lg:order-2" : ""}`}>
          <span className="font-mono text-caption text-fg-3">0{index + 1}</span>
          <h2 id={`${id}-h`} className="m-0 text-balance text-title-1 font-semibold text-fg md:text-display-2">{title}</h2>
          <div className="max-w-[56ch] text-lede text-fg-2">{body}</div>
        </div>
        <div className="min-w-0">{children}</div>
      </Container>
    </section>
  );
}

const Panel = ({ children }: { children: React.ReactNode }) => <div className="overflow-hidden rounded-stage border border-border bg-s1 shadow-e2">{children}</div>;
const Line = ({ k, children }: { k: string; children: React.ReactNode }) => (
  <div className="flex min-h-14 flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border-soft px-5 py-3 first:border-t-0">
    <span className="w-[120px] shrink-0 text-callout text-fg-3">{k}</span>
    <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-ui text-fg">{children}</span>
  </div>
);

export default function Product() {
  return (
    <>
      <PageHero eyebrow="Product" title="Incident memory, from the outage to every pull request after it." lede="Every feature rests on one idea: a lesson only counts once a test proves it against your own git history.">
        <nav aria-label="Features on this page" className="flex flex-wrap gap-2">
          {[["#time-travel", "Time travel"], ["#guard", "Pull request guard"], ["#epicenter", "Epicenter"], ["#still-guarding", "Still guarding"], ["#seen", "Seen before"], ["#insights", "Insights"]].map(([h, l]) => (
            <a key={h} href={h} className="inline-flex min-h-9 items-center rounded-full border border-border bg-s1 px-3.5 text-callout text-fg-2 no-underline transition-colors duration-150 hover:border-border-strong hover:text-fg">{l}</a>
          ))}
        </nav>
      </PageHero>

      <Feature index={0} id="time-travel" title="Time travel proves each test" body={<p className="m-0">The model drafts one test. A fresh sandbox runs it three times on the commit before the fix and three times on the fix. Fails, then passes: proven. Anything else is redrafted with the failure as feedback, up to three times, or the incident stays unproven with the reason.</p>}>
        <Panel>
          <Line k="Before the fix"><span className="font-mono">3f2a1c9</span><Verdict kind="recur" label="failed 3 of 3" /></Line>
          <Line k="On the fix"><span className="font-mono">aa86f56</span><Verdict kind="proven" label="passed 3 of 3" /></Line>
          <Line k="Result"><Verdict kind="proven" /><span className="text-fg-2">bot pull request #52 adds the test</span></Line>
        </Panel>
      </Feature>

      <Feature index={1} id="guard" title="One check per pull request, with its risk" body={<p className="m-0">Only the memory tests whose files a change touches run, plus any the model’s triage adds; triage can add tests but never remove them. Each check also shows how close the change comes to code behind past incidents, even when no test runs. Merge queues are checked on the queue’s own commit.</p>}>
        <Panel>
          <Line k="Pull request">#214 refactor payments</Line>
          <Line k="Verdict"><Verdict kind="recur" /><span className="text-fg-2">INC-12 would ship again</span></Line>
          <Line k="Risk"><span className="font-semibold text-recur">High</span><span className="text-fg-2">touches app/services/payment_service.py, the code behind INC-12 and INC-7</span></Line>
          <Line k="Skipped"><Verdict kind="skipped" label="3 unrelated" /></Line>
        </Panel>
      </Feature>

      <Feature index={2} id="epicenter" title="Epicenter finds where the bug began" body={<p className="m-0">With a proven test, Aftershock bisects your history to the commit, and pull request, that introduced the bug. Over time that shows which kinds of change cause incidents.</p>}>
        <Panel>
          <Line k="Introduced in"><span className="font-mono">5d0c2e1</span><span className="text-fg-2">PR #31 feat: mock payments endpoint</span></Line>
          <Line k="Commits tested">4</Line>
        </Panel>
      </Feature>

      <Feature index={3} id="still-guarding" title="Still guarding, and how strongly" body={<p className="m-0">Every week the fix is undone on today’s code and each test must fail again; tests that would no longer notice are flagged <em>Weak</em>. Mutation testing makes small changes to the fixed lines and measures how many a test catches, so a loose test can be hardened with a second proven one.</p>}>
        <Panel>
          <Line k="INC-12"><Verdict kind="safe" label="Still guarding" /><span className="text-fg-2">strength 92%</span></Line>
          <Line k="INC-7"><Verdict kind="inconclusive" label="Weak" /><span className="text-fg-2">misses refund.py:42 → “if amount &lt; total”</span></Line>
        </Panel>
      </Feature>

      <Feature index={4} id="seen" title="It knows when it has seen this before" body={<p className="m-0">A new alert or issue that looks like a past incident, from the same files or a similar error, is linked to it, with one click to re-run that incident’s test on main. When a merged pull request changes the files an open alert points at, it is suggested as the fix.</p>}>
        <Panel>
          <Line k="INC-31"><span className="font-semibold text-recur">Looks like INC-16 again</span><span className="text-fg-2">same file app/services/order_service.py</span></Line>
          <Line k="Suggested fix"><span>PR #88 Guard duplicate charge</span><span className="text-fg-2">changes app/services/payment_service.py</span></Line>
        </Panel>
      </Feature>

      <Feature index={5} id="insights" title="Insights, a shareable report, and answers" body={<p className="m-0">Proof rate, time to proof, recurrences blocked, test health and strength, and the files behind the most incidents. Share a read-only reliability report with leadership by secret link, and ask questions in plain language. Answers come only from your incidents and always cite them.</p>}>
        <CodeBlock file="Ask Aftershock" copy={false} code={`What breaks when we touch checkout?

Checkout totals overflowed for large orders (INC-3), and a
discount applied twice when the cart was refreshed (INC-17).
Both have proven tests guarding app/checkout/.

Sources: INC-3, INC-17`} />
      </Feature>

      <section aria-labelledby="cta-h" className="border-t border-border-soft">
        <Container className="flex flex-col items-start justify-between gap-6 py-20 md:flex-row md:items-center lg:py-28">
          <h2 id="cta-h" className="m-0 text-title-1 font-semibold text-fg">See it on your own last incident.</h2>
          <div className="flex flex-wrap gap-3"><ButtonLink href="/signin" size="lg">Install on GitHub</ButtonLink><ButtonLink href="/docs" size="lg" variant="secondary">Quickstart</ButtonLink></div>
        </Container>
      </section>
    </>
  );
}
