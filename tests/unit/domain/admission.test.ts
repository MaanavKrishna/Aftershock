import { describe, test, expect } from "vitest";
import { decideAdmission } from "@/lib/domain/admission";
import type { RunResult } from "@/lib/domain/verdict";

const runs = (...o: RunResult["outcome"][]): RunResult[] => o.map((outcome) => ({ outcome, durationMs: 5 }));

describe("decideAdmission", () => {
  test("fails before the fix and passes on it: proven", () => {
    expect(decideAdmission(runs("failed", "failed", "failed"), runs("passed", "passed", "passed")).status).toBe("proven");
  });
  test("passing before the fix is rejected with feedback for the next draft", () => {
    const d = decideAdmission(runs("passed", "passed", "passed"), runs("passed", "passed", "passed"));
    expect(d.status).toBe("rejected");
    expect(d.feedback).toMatch(/passed before the fix/);
  });
  test("an environment error before the fix is unproven, not a reproduction", () => {
    const d = decideAdmission(runs("failed", "error", "failed"), runs("passed", "passed", "passed"));
    expect(d.status).toBe("unproven");
    expect(d.reason).toMatch(/environment/i);
  });
  test("a failure on the fix is unproven", () => {
    expect(decideAdmission(runs("failed", "failed", "failed"), runs("passed", "failed", "passed")).status).toBe("unproven");
  });
  test("too few runs is unproven", () => {
    expect(decideAdmission(runs("failed", "failed"), runs("passed", "passed", "passed")).status).toBe("unproven");
  });
  test("flaky before the fix is unproven", () => {
    expect(decideAdmission(runs("failed", "passed", "failed"), runs("passed", "passed", "passed")).status).toBe("unproven");
  });
});
