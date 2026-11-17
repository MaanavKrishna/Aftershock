import { ButtonLink } from "@/components/ui/Button";
import { WorkspaceForm } from "@/app/(app)/settings/forms";
import { setFlag } from "@/app/(app)/actions";
import { FLAGS, flagEnabled, type Flag } from "@/lib/flags";
import { planFor } from "@/lib/billing/plans";
import { hours } from "@/lib/format";
import { Note, Row, Section, type Rows } from "./Section";

type Workspace = NonNullable<Rows<"workspace">>;

export function WorkspaceTab({ ws }: { ws: Workspace }) {
  return (
    <Section title="Workspace" sub="Linked to your GitHub account or organisation.">
      <WorkspaceForm name={ws.name} prefix={ws.incidentPrefix} label={ws.settings.issueLabel ?? "incident"} autoImport={ws.settings.autoImportIssues ?? true} autoTravel={ws.settings.autoTravelOnMerge ?? true} />
    </Section>
  );
}

const RULES: [string, string, string][] = [
  ["Runs per commit", "Time travel runs the draft this many times before and after the fix.", "3"],
  ["Drafts per incident", "Redrafts with failure feedback before giving up as Unproven.", "3"],
  ["Pull request runs", "Runs per relevant test on the head commit.", "3"],
  ["Fail before, pass after", "The admission rule itself.", "always on"],
  ["Mixed results", "How a check that passes some runs is shown.", "inconclusive"],
];

export function AdmissionTab() {
  return (
    <Section title="Admission rules" sub="How strict time travel and pull request checks are.">
      {RULES.map(([k, d, v]) => (
        <Row key={k} title={k} sub={d}>
          <span className="inline-flex min-h-7 items-center rounded-chip border border-border bg-s2 px-2.5 font-mono text-callout font-medium text-fg">{v}</span>
        </Row>
      ))}
      <p className="m-0 border-t border-border-soft bg-s2 px-5 py-3 text-callout text-fg-3 sm:px-6">These values are fixed so every workspace’s “Proven” means the same thing.</p>
    </Section>
  );
}

function Meter({ label, value, pct }: { label: string; value: string; pct: number | null }) {
  return (
    <div className="flex flex-col gap-2 bg-s1 px-5 py-4 sm:px-6">
      <span className="text-callout text-fg-3">{label}</span>
      <span className="text-title-2 font-semibold tabular-nums text-fg">{value}</span>
      {pct !== null && (
        <span className="h-1.5 overflow-hidden rounded-full bg-s2" role="img" aria-label={`${Math.round(pct)}% of the plan limit`}>
          <span className={`block h-full rounded-full ${pct >= 100 ? "bg-recur" : "bg-fg-2"}`} style={{ width: `${Math.min(100, pct)}%` }} />
        </span>
      )}
    </div>
  );
}

export function BillingTab({ ws, usage, repoCount }: { ws: Workspace; usage: Rows<"usage">; repoCount: number }) {
  const plan = planFor(ws.plan);
  const capped = Number.isFinite(plan.maxCommitters);
  return (
    <Section
      title={`Plan · ${plan.label}`}
      sub="Unlimited public repositories on every plan. Paid plans are free during the beta."
      aside={
        <ButtonLink href="/pricing" variant="secondary" size="sm">
          Compare plans
        </ButtonLink>
      }
    >
      <div className="grid grid-cols-1 gap-px bg-border-soft sm:grid-cols-2">
        <Meter label="Active committers (30 days)" value={`${usage.committers}${capped ? ` / ${plan.maxCommitters}` : ""}`} pct={capped ? (usage.committers / plan.maxCommitters) * 100 : null} />
        <Meter label="Repositories" value={`${repoCount}`} pct={null} />
        <Meter label="Sandbox CPU-hours" value={`${hours(usage.sandboxCpuMs)} / ${hours(usage.allowanceMs)}`} pct={(usage.sandboxCpuMs / usage.allowanceMs) * 100} />
        <Meter label="Model drafts this month" value={`${usage.drafts}`} pct={null} />
      </div>
    </Section>
  );
}

export function LabsTab({ ws, admin }: { ws: Workspace; admin: boolean }) {
  return (
    <Section title="Labs" sub="Features that are new. Turn them on for this workspace; turn them off any time.">
      <ul className="m-0 list-none p-0">
        {(Object.keys(FLAGS) as Flag[]).map((flag) => {
          const on = flagEnabled(flag, ws.settings);
          return (
            <li key={flag} className="flex items-center justify-between gap-4 border-b border-border-soft px-5 py-3 last:border-b-0 sm:px-6">
              <span className="text-ui text-fg" id={`flag-${flag}`}>
                {FLAGS[flag]}
              </span>
              <form action={setFlag} className="shrink-0">
                <input type="hidden" name="flag" value={flag} />
                <input type="hidden" name="on" value={on ? "0" : "1"} />
                <button
                  type="submit"
                  role="switch"
                  aria-checked={on}
                  aria-labelledby={`flag-${flag}`}
                  disabled={!admin}
                  className={`relative inline-flex h-6 w-10 cursor-pointer items-center rounded-full border-0 p-0.5 transition-colors duration-200 ease-fl disabled:cursor-not-allowed disabled:opacity-50 ${on ? "bg-signal" : "bg-fg-3"}`}
                >
                  <span aria-hidden="true" className={`h-5 w-5 rounded-full shadow-e1 transition-transform duration-200 ease-fl bg-canvas ${on ? "translate-x-4" : "translate-x-0"}`} />
                </button>
              </form>
            </li>
          );
        })}
      </ul>
      {!admin && <Note>Only owners and admins can change Labs features.</Note>}
    </Section>
  );
}
