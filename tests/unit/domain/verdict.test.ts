import { describe, test, expect } from "vitest";
import { prVerdict, aggregatePr, type RunResult } from "@/lib/domain/verdict";

const r = (outcome: RunResult["outcome"]): RunResult => ({ outcome, durationMs: 10 });

describe("prVerdict", () => {
  test("all runs failing means the incident would recur", () => {
    expect(prVerdict([r("failed"), r("failed"), r("failed")])).toBe("recur");
  });
  test("all runs passing is safe", () => {
    expect(prVerdict([r("passed"), r("passed"), r("passed")])).toBe("safe");
  });
  test("mixed pass and fail is inconclusive, never green", () => {
    expect(prVerdict([r("passed"), r("passed"), r("failed")])).toBe("inconclusive");
  });
  test("any environment error makes it inconclusive even if others failed", () => {
    expect(prVerdict([r("failed"), r("failed"), r("error")])).toBe("inconclusive");
  });
  test("no runs is skipped", () => {
    expect(prVerdict([])).toBe("skipped");
  });
});

describe("aggregatePr", () => {
  test("any recur wins", () => {
    expect(aggregatePr(["safe", "inconclusive", "recur"])).toBe("recur");
  });
  test("inconclusive beats safe", () => {
    expect(aggregatePr(["safe", "inconclusive"])).toBe("inconclusive");
  });
  test("all skipped or empty is skipped", () => {
    expect(aggregatePr(["skipped", "skipped"])).toBe("skipped");
    expect(aggregatePr([])).toBe("skipped");
  });
  test("safe with some skipped is safe", () => {
    expect(aggregatePr(["safe", "skipped"])).toBe("safe");
  });
});
