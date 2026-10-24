/** What each plan includes. Billing (v0.3) charges per active committer; until then plans are metered, not enforced. */
export type PlanId = "free" | "team" | "business";

export type Plan = {
  id: PlanId;
  label: string;
  /** Sandbox CPU-hours a month included regardless of team size. */
  baseHours: number;
  /** Extra sandbox CPU-hours a month per active committer. */
  hoursPerCommitter: number;
  /** Active committers included (on private repositories). */
  maxCommitters: number;
  evidenceExport: boolean;
};

export const PLANS: Record<PlanId, Plan> = {
  free: { id: "free", label: "Free", baseHours: 5, hoursPerCommitter: 0, maxCommitters: 5, evidenceExport: false },
  team: { id: "team", label: "Team", baseHours: 0, hoursPerCommitter: 15, maxCommitters: Infinity, evidenceExport: false },
  business: { id: "business", label: "Business", baseHours: 0, hoursPerCommitter: 15, maxCommitters: Infinity, evidenceExport: true },
};

export function planFor(id: string | null | undefined): Plan {
  return PLANS[(id as PlanId) in PLANS ? (id as PlanId) : "free"];
}

const H = 3_600_000;

/** Monthly sandbox allowance. Paid plans pool hours across the team, with at least one committer's worth. */
export function allowanceMs(planId: string, activeCommitters: number): number {
  const p = planFor(planId);
  return (p.baseHours + p.hoursPerCommitter * Math.max(1, activeCommitters)) * H;
}

/** Bots (Dependabot, Renovate, GitHub Apps including Aftershock itself) are never billed as committers. */
export function isBot(author: { login: string; type?: string }): boolean {
  return author.type === "Bot" || /\[bot\]$/i.test(author.login);
}
