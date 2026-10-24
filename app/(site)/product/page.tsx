import type { Metadata } from "next";
import { DsLink } from "@/components/ds/Button";
import { Verdict } from "@/components/ds/Verdict";
import { CodeBlock } from "@/components/ds/CodeBlock";

export const metadata: Metadata = { title: "Product", description: "Time travel, pull request guard, risk, Epicenter, still-guarding re-proofs, test strength, insights and Ask Aftershock.", alternates: { canonical: "/product" } };

function Feature({ title, body, children, id }: { title: string; body: React.ReactNode; children: React.ReactNode; id: string }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="border-t border-rule">
      <div className="mx-auto grid max-w-[1240px] items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-20">
        <div className="flex flex-col gap-4">
          <h2 id={`${id}-h`} className="m-0 text-balance font-display text-d2 font-semibold tracking-[-0.03em] text-fg">{title}</h2>
          <div className="max-w-[56ch] text-lede text-fg-2">{body}</div>
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </section>
  );
}

const Panel = ({ children }: { children: React.ReactNode }) => <div className="overflow-hidden rounded-panel border border-rule bg-raised shadow-lift">{children}</div>;
const Line = ({ k, children }: { k: string; children: React.ReactNode }) => (
  <div className="flex min-h-12 flex-wrap items-center gap-x-4 gap-y-1 border-t border-rule px-5 py-3 first:border-t-0"><span className="w-[120px] shrink-0 text-[13px] text-fg-3">{k}</span><span className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-[14.5px] text-fg">{children}</span></div>
);

export default function Product() {
  return (
    <>
      <section className="mx-auto max-w-[1240px] px-4 pb-14 pt-16 sm:px-6 sm:pt-20">
        <h1 className="m-0 max-w-[20ch] text-balance font-display text-d1 font-semibold tracking-[-0.03em] text-fg">Incident memory, from the outage to every pull request after it.</h1>
        <p className="mt-6 max-w-[60ch] text-lede text-fg-2">Every feature rests on one idea: a lesson only counts once a test proves it against your own git history.</p>
      </section>

      <Feature id="time-travel" title="Time travel proves each test" body={<p className="m-0">The model drafts one test. A fresh sandbox runs it three times on the commit before the fix and three times on the fix. Fails, then passes: proven. Anything else is redrafted with the failure as feedback, up to three times, or the incident stays unproven with the reason.</p>}>
        <Panel>
          <Line k="Before the fix"><span className="font-code">3f2a1c9</span><Verdict kind="recur" label="failed 3 of 3" /></Line>
          <Line k="On the fix"><span className="font-code">aa86f56</span><Verdict kind="proven" label="passed 3 of 3" /></Line>
          <Line k="Result"><Verdict kind="proven" /><span className="text-fg-2">bot pull request #52 adds the test</span></Line>
        </Panel>
      </Feature>

      <Feature id="guard" title="One check per pull request, with its risk" body={<p className="m-0">Only the memory tests whose files a change touches run, plus any the model’s triage adds; triage can add tests but never remove them. Each check also shows how close the change comes to code behind past incidents, even when no test runs. Merge queues are checked on the queue’s own commit.</p>}>
        <Panel>
          <Line k="Pull request">#214 refactor payments</Line>
          <Line k="Verdict"><Verdict kind="recur" /><span className="text-fg-2">INC-12 would ship again</span></Line>
          <Line k="Risk"><span className="font-semibold text-quake">High</span><span className="text-fg-2">touches app/services/payment_service.py, the code behind INC-12 and INC-7</span></Line>
          <Line k="Skipped"><Verdict kind="skipped" label="3 unrelated" /></Line>
        </Panel>
      </Feature>

      <Feature id="epicenter" title="Epicenter finds where the bug began" body={<p className="m-0">With a proven test, Aftershock bisects your history to the commit, and pull request, that introduced the bug. Over time that shows which kinds of change cause incidents.</p>}>
        <Panel>
          <Line k="Introduced in"><span className="font-code">5d0c2e1</span><span className="text-fg-2">PR #31 feat: mock payments endpoint</span></Line>
          <Line k="Commits tested">4</Line>
        </Panel>
      </Feature>

      <Feature id="still-guarding" title="Still guarding, and how strongly" body={<p className="m-0">Every week the fix is undone on today’s code and each test must fail again; tests that would no longer notice are flagged <em>Weak</em>. Mutation testing makes small changes to the fixed lines and measures how many a test catches, so a loose test can be hardened with a second proven one.</p>}>
        <Panel>
          <Line k="INC-12"><Verdict kind="safe" label="Still guarding" /><span className="text-fg-2">strength 92%</span></Line>
          <Line k="INC-7"><Verdict kind="inconclusive" label="Weak" /><span className="text-fg-2">misses refund.py:42 → “if amount &lt; total”</span></Line>
        </Panel>
      </Feature>

      <Feature id="seen" title="It knows when it has seen this before" body={<p className="m-0">A new alert or issue that looks like a past incident, from the same files or a similar error, is linked to it, with one click to re-run that incident’s test on main. When a merged pull request changes the files an open alert points at, it is suggested as the fix.</p>}>
        <Panel>
          <Line k="INC-31"><span className="font-semibold text-quake">Looks like INC-16 again</span><span className="text-fg-2">same file app/services/order_service.py</span></Line>
          <Line k="Suggested fix"><span>PR #88 Guard duplicate charge</span><span className="text-fg-2">changes app/services/payment_service.py</span></Line>
        </Panel>
      </Feature>

      <Feature id="insights" title="Insights, a shareable report, and answers" body={<p className="m-0">Proof rate, time to proof, recurrences blocked, test health and strength, and the files behind the most incidents. Share a read-only reliability report with leadership by secret link, and ask questions in plain language. Answers come only from your incidents and always cite them.</p>}>
        <CodeBlock file="Ask Aftershock" copy={false} code={`What breaks when we touch checkout?

Checkout totals overflowed for large orders (INC-3), and a
discount applied twice when the cart was refreshed (INC-17).
Both have proven tests guarding app/checkout/.

Sources: INC-3, INC-17`} />
      </Feature>

      <section className="border-t border-rule">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-6 px-4 py-16 sm:px-6">
          <h2 className="m-0 font-display text-d3 font-semibold text-fg">See it on your own last incident.</h2>
          <div className="flex flex-wrap gap-3"><DsLink href="/signin">Install on GitHub</DsLink><DsLink href="/docs" variant="secondary">Quickstart</DsLink></div>
        </div>
      </section>
    </>
  );
}
