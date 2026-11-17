import type { ReactNode } from "react";
import { Verdict } from "@/components/ui/Verdict";
import { Bolt, Check, Cross, Memory, PullRequest, Shield, Commit, Github } from "@/components/ui/icons";
import { SpotlightGrid } from "./Spotlight";

function Cell({ icon, title, body, children, className = "" }: { icon: ReactNode; title: string; body: ReactNode; children: ReactNode; className?: string }) {
  return (
    <article data-spotlight className={`spotlight-card flex min-w-0 flex-col gap-6 rounded-stage border border-border bg-s1 p-6 shadow-e1 sm:p-7 ${className}`}>
      <div className="flex flex-col gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-control border border-border bg-s2 text-fg-2" aria-hidden="true">{icon}</span>
        <h3 className="m-0 mt-2 text-title-3 font-semibold text-fg">{title}</h3>
        <p className="m-0 max-w-[48ch] text-body text-fg-2">{body}</p>
      </div>
      <div className="mt-auto min-w-0">{children}</div>
    </article>
  );
}

/** A small inset surface for the illustration inside a cell. */
const Well = ({ children, className = "" }: { children: ReactNode; className?: string }) => <div className={`flex flex-col overflow-hidden rounded-card border border-border-soft bg-canvas ${className}`}>{children}</div>;
const WellRow = ({ children }: { children: ReactNode }) => <div className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 border-t border-border-soft px-4 py-2 text-callout first:border-t-0">{children}</div>;

function Runs({ kind }: { kind: "fail" | "pass" }) {
  return (
    <span className="flex gap-1" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span key={i} className={`flex h-6 w-6 items-center justify-center rounded-chip ${kind === "fail" ? "bg-recur-soft text-recur" : "bg-proven-soft text-proven"}`}>
          {kind === "fail" ? <Cross size={12} /> : <Check size={12} />}
        </span>
      ))}
    </span>
  );
}

/** The proof grid: capture, prove, guard, memory, checks and security, each with one pointer-following glow. */
export function Bento() {
  return (
    <SpotlightGrid className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Cell icon={<Bolt size={18} />} title="Capture" body="A labelled GitHub issue, a pasted postmortem, or an alert from Sentry, PagerDuty and others opens an incident. Alerts wait for the pull request that fixes them.">
        <Well>
          <WellRow><Github size={14} className="text-fg-3" /><span className="text-fg">Issue #41</span><span className="ml-auto"><Verdict kind="awaiting" size="sm" /></span></WellRow>
          <WellRow><span className="font-mono text-fg-3">sentry</span><span className="text-fg">New error issue</span><span className="ml-auto"><Verdict kind="awaiting" size="sm" /></span></WellRow>
          <WellRow><span className="font-mono text-fg-3">pagerduty</span><span className="text-fg">Triggered</span><span className="ml-auto"><Verdict kind="awaiting" size="sm" /></span></WellRow>
        </Well>
      </Cell>

      <Cell className="lg:col-span-2" icon={<Commit size={18} />} title="Prove" body="A model drafts one test. A fresh sandbox runs it three times on the commit before the fix and three times on the fix. Fails, then passes: proven. Anything else is redrafted or rejected.">
        <Well>
          <WellRow><span className="w-28 text-fg-3">Before the fix</span><span className="font-mono text-fg">3f2a1c9</span><Runs kind="fail" /><span className="text-fg-2">fails 3 of 3</span></WellRow>
          <WellRow><span className="w-28 text-fg-3">On the fix</span><span className="font-mono text-fg">aa86f56</span><Runs kind="pass" /><span className="text-fg-2">passes 3 of 3</span><span className="ml-auto"><Verdict kind="proven" size="sm" /></span></WellRow>
        </Well>
      </Cell>

      <Cell className="lg:col-span-2" icon={<PullRequest size={18} />} title="Guard" body="The proven test lands in your repository through a pull request. From then on, every change that touches the same code runs it before it can merge.">
        <Well>
          <WellRow><span className="font-medium text-fg">#214 refactor payments</span><span className="text-fg-3">touches app/services/payment_service.py</span></WellRow>
          <WellRow>
            <Verdict kind="recur" size="sm" />
            <span className="font-mono text-fg-2">test_inc_12_payment_retry</span>
            <span className="text-fg-3">failed again, merge blocked</span>
          </WellRow>
        </Well>
      </Cell>

      <Cell icon={<Memory size={18} />} title="Memory" body="Proven tests form a suite that stays honest. Every week the fix is undone on today’s code and each test must fail again.">
        <Well>
          <WellRow><span className="font-mono text-fg">INC-12</span><Verdict kind="safe" size="sm" label="Still guarding" /><span className="ml-auto tabular-nums text-fg-2">92%</span></WellRow>
          <WellRow><span className="font-mono text-fg">INC-7</span><Verdict kind="weak" size="sm" /><span className="ml-auto text-fg-3">harden it</span></WellRow>
        </Well>
      </Cell>

      <Cell icon={<Check size={18} />} title="One check per pull request" body="Only the memory tests a change touches run, in the hosted sandbox or on your own GitHub Actions. One check, one comment.">
        <div className="flex flex-wrap gap-2">
          <Verdict kind="recur" />
          <Verdict kind="safe" />
          <Verdict kind="inconclusive" />
          <Verdict kind="skipped" />
        </div>
      </Cell>

      <Cell className="lg:col-span-2" icon={<Shield size={18} />} title="Hostile by default" body="Every run gets a fresh Firecracker microVM, a read-only clone, no secrets, and no network while tests run. Then the machine is destroyed.">
        <ol className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-4">
          {["Fresh microVM", "Read-only clone", "Network deny-all", "Destroyed"].map((s, i) => (
            <li key={s} className="flex flex-col gap-1 rounded-card border border-border-soft bg-canvas px-3 py-3">
              <span className="font-mono text-caption text-fg-3">0{i + 1}</span>
              <span className="text-callout font-medium text-fg">{s}</span>
            </li>
          ))}
        </ol>
      </Cell>
    </SpotlightGrid>
  );
}
