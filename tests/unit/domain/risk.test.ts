import { describe, test, expect } from "vitest";
import { riskOf } from "@/lib/domain/risk";

const incidents = [
  { key: "INC-3", status: "proven", watchedFiles: ["app/cart.py", "app/totals.py"] },
  { key: "INC-7", status: "proven", watchedFiles: ["app/cart.py"] },
  { key: "INC-9", status: "awaiting_fix", watchedFiles: ["app/payments.py"] },
];

describe("riskOf", () => {
  test("no overlap with past incidents is low risk with no reasons", () => {
    expect(riskOf(["README.md"], incidents)).toEqual({ level: "low", score: 0, incidents: [], reasons: [] });
  });
  test("touching code behind one proven incident is medium", () => {
    const r = riskOf(["app/totals.py"], incidents);
    expect(r).toMatchObject({ level: "medium", incidents: ["INC-3"] });
    expect(r.reasons).toEqual(["Touches app/totals.py, the code behind INC-3"]);
  });
  test("a file behind several incidents is high risk", () => {
    const r = riskOf(["app/cart.py"], incidents);
    expect(r.level).toBe("high");
    expect(r.incidents).toEqual(["INC-3", "INC-7"]);
    expect(r.reasons[0]).toBe("Touches app/cart.py, the code behind INC-3 and INC-7");
  });
  test("an incident still awaiting its fix counts too", () => {
    expect(riskOf(["app/payments.py"], incidents)).toMatchObject({ level: "medium", incidents: ["INC-9"] });
  });
  test("reasons are capped and ordered by weight", () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ key: `INC-${i}`, status: "proven", watchedFiles: [`f${i}.py`] }));
    const r = riskOf(many.map((m) => m.watchedFiles[0]), many);
    expect(r.level).toBe("high");
    expect(r.reasons.length).toBeLessThanOrEqual(5);
  });
});
