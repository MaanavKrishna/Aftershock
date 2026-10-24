import type { Metadata } from "next";
import { DsLink } from "@/components/ds/Button";
import { Verdict, type VerdictKind } from "@/components/ds/Verdict";
import { CodeBlock } from "@/components/ds/CodeBlock";
import { LogoMark } from "@/components/ui/Logo";

export const metadata: Metadata = { title: "Styleguide", robots: { index: false, follow: false } };

const COLORS = ["canvas", "raised", "raised-2", "sunken", "fg", "fg-2", "fg-3", "rule", "rule-strong", "signal", "quake", "amber", "violet"];
const KINDS: VerdictKind[] = ["proven", "safe", "recur", "failing", "inconclusive", "skipped", "drafted"];

/** Every token and primitive in one place, checked in both themes by the e2e suite. */
export default function Styleguide() {
  return (
    <section className="mx-auto flex max-w-[1240px] flex-col gap-14 px-4 py-16 sm:px-6">
      <h1 className="m-0 font-display text-d1 font-semibold tracking-[-0.03em] text-fg">Aftershock DS 2</h1>
      <div className="flex flex-col gap-4">
        <h2 className="m-0 font-display text-d3 font-semibold text-fg">Colour</h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
          {COLORS.map((c) => (
            <div key={c} className="flex flex-col gap-2"><span className="h-16 rounded-control border border-rule" style={{ background: `var(--color-${c})` }} /><span className="font-code text-[12.5px] text-fg-2">{c}</span></div>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <h2 className="m-0 font-display text-d3 font-semibold text-fg">Type</h2>
        <p className="m-0 font-display text-d1 font-semibold tracking-[-0.03em] text-fg">Display d1</p>
        <p className="m-0 font-display text-d2 font-semibold tracking-[-0.03em] text-fg">Display d2</p>
        <p className="m-0 font-display text-d3 font-semibold text-fg">Display d3</p>
        <p className="m-0 text-lede text-fg-2">Lede: Inter at a fluid size for introductions.</p>
        <p className="m-0 text-fg-2">Body: Inter 16px with tabular figures 0123456789.</p>
        <p className="m-0 font-code text-[14px] text-fg">Code: JetBrains Mono 3f2a1c9 aa86f56</p>
      </div>
      <div className="flex flex-col gap-4">
        <h2 className="m-0 font-display text-d3 font-semibold text-fg">Verdicts</h2>
        <div className="flex flex-wrap gap-2">{KINDS.map((k) => <Verdict key={k} kind={k} />)}</div>
      </div>
      <div className="flex flex-col gap-4">
        <h2 className="m-0 font-display text-d3 font-semibold text-fg">Actions and mark</h2>
        <div className="flex flex-wrap items-center gap-3"><DsLink href="/styleguide">Primary</DsLink><DsLink href="/styleguide" variant="secondary">Secondary</DsLink><DsLink href="/styleguide" variant="quiet">Quiet</DsLink><LogoMark size={40} accent /><LogoMark size={40} inverted /></div>
      </div>
      <CodeBlock file="tests/aftershock/test_inc_12.py" mark={[3]} code={`def test_retry_is_rejected(client, order):\n    client.post("/payments", json={"order_id": order.id})\n    assert client.post("/payments", json={"order_id": order.id}).status_code == 400`} />
    </section>
  );
}
