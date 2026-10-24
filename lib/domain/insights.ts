import { faultLines } from "./faultlines";

type In = {
  now: Date;
  incidents: { status: string; createdAt: Date; provenAt: Date | null; watchedFiles: string[] }[];
  checks: { verdict: string | null; overridden: boolean; createdAt: Date }[];
  tests: { health: string; guardStatus: string | null; strength: number | null }[];
};

const WEEK = 7 * 86_400_000;
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Reliability numbers for a workspace: what was proven, how fast, and what it stopped. No titles or code. */
export function insightsFrom(d: In) {
  const count = (status: string) => d.incidents.filter((i) => i.status === status).length;
  const proven = count("proven");
  const unproven = count("unproven");
  const hours = d.incidents.filter((i) => i.provenAt).map((i) => (i.provenAt!.getTime() - i.createdAt.getTime()) / 3_600_000);
  const verdict = (v: string) => d.checks.filter((c) => c.verdict === v).length;
  const strengths = d.tests.map((t) => t.strength).filter((x): x is number => typeof x === "number");
  const tcount = (k: "health" | "guardStatus", v: string) => d.tests.filter((t) => t[k] === v).length;
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const end = d.now.getTime() - (7 - i) * WEEK;
    const start = end - WEEK;
    const inWeek = (t: Date) => t.getTime() > start && t.getTime() <= end;
    return {
      weekStart: new Date(start).toISOString().slice(0, 10),
      opened: d.incidents.filter((x) => inWeek(x.createdAt)).length,
      proven: d.incidents.filter((x) => x.provenAt && inWeek(x.provenAt)).length,
      blocked: d.checks.filter((c) => c.verdict === "recur" && !c.overridden && inWeek(c.createdAt)).length,
    };
  });
  return {
    incidents: { total: d.incidents.length, proven, awaiting: count("awaiting_fix"), unproven },
    proofRate: pct(proven, proven + unproven),
    medianHoursToProof: median(hours) === null ? null : Math.round(median(hours)! * 10) / 10,
    recurrencesBlocked: d.checks.filter((c) => c.verdict === "recur" && !c.overridden).length,
    overridden: d.checks.filter((c) => c.overridden).length,
    checks: { total: d.checks.length, recur: verdict("recur"), safe: verdict("safe"), inconclusive: verdict("inconclusive"), skipped: verdict("skipped") },
    tests: { total: d.tests.length, healthy: tcount("health", "healthy"), flaky: tcount("health", "flaky"), failing: tcount("health", "failing"), guarding: tcount("guardStatus", "guarding"), weak: tcount("guardStatus", "weak"), drifted: tcount("guardStatus", "drifted"), avgStrength: strengths.length ? Math.round(strengths.reduce((a, b) => a + b, 0) / strengths.length) : null },
    faultLines: faultLines(d.incidents).slice(0, 8),
    weeks,
  };
}
export type Insights = ReturnType<typeof insightsFrom>;
