import { describe, test, expect } from "vitest";
import { insightsFrom } from "@/lib/domain/insights";

const NOW = new Date("2026-10-24T12:00:00Z");
const d = (daysAgo: number, h = 0) => new Date(NOW.getTime() - daysAgo * 86_400_000 + h * 3_600_000);

describe("insightsFrom", () => {
  const data = {
    now: NOW,
    incidents: [
      { status: "proven", createdAt: d(20), provenAt: d(20, 6), watchedFiles: ["app/cart.py"] },
      { status: "proven", createdAt: d(10), provenAt: d(10, 2), watchedFiles: ["app/cart.py", "app/pay.py"] },
      { status: "awaiting_fix", createdAt: d(3), provenAt: null, watchedFiles: [] },
      { status: "unproven", createdAt: d(2), provenAt: null, watchedFiles: ["app/pay.py"] },
    ],
    checks: [
      { verdict: "recur", overridden: false, createdAt: d(5) },
      { verdict: "recur", overridden: true, createdAt: d(4) },
      { verdict: "safe", overridden: false, createdAt: d(4) },
      { verdict: "skipped", overridden: false, createdAt: d(1) },
      { verdict: "inconclusive", overridden: false, createdAt: d(1) },
    ],
    tests: [
      { health: "healthy", guardStatus: "guarding", strength: 80 },
      { health: "flaky", guardStatus: "weak", strength: 40 },
    ],
  };
  test("headline numbers", () => {
    const i = insightsFrom(data);
    expect(i.incidents).toEqual({ total: 4, proven: 2, awaiting: 1, unproven: 1 });
    expect(i.proofRate).toBe(67);
    expect(i.medianHoursToProof).toBe(4);
    expect(i.recurrencesBlocked).toBe(1);
    expect(i.overridden).toBe(1);
    expect(i.checks).toEqual({ total: 5, recur: 2, safe: 1, inconclusive: 1, skipped: 1 });
    expect(i.tests).toEqual({ total: 2, healthy: 1, flaky: 1, failing: 0, guarding: 1, weak: 1, drifted: 0, avgStrength: 60 });
    expect(i.faultLines[0]).toEqual({ file: "app/cart.py", count: 2 });
  });
  test("eight weekly buckets, oldest first, ending this week", () => {
    const i = insightsFrom(data);
    expect(i.weeks).toHaveLength(8);
    expect(i.weeks.at(-1)).toMatchObject({ opened: 2, blocked: 1 });
    expect(i.weeks.reduce((n, w) => n + w.opened, 0)).toBe(4);
    expect(i.weeks.reduce((n, w) => n + w.blocked, 0)).toBe(1);
  });
  test("empty workspaces give zeros, not NaN", () => {
    const i = insightsFrom({ now: NOW, incidents: [], checks: [], tests: [] });
    expect(i.proofRate).toBe(0);
    expect(i.medianHoursToProof).toBeNull();
    expect(i.tests.avgStrength).toBeNull();
  });
});
