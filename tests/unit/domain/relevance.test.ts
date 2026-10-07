import { describe, test, expect } from "vitest";
import { relevantTests } from "@/lib/domain/relevance";
import { faultLines } from "@/lib/domain/faultlines";

const tests = [
  { id: "t12", watchedFiles: ["app/services/payment_service.py"] },
  { id: "t07", watchedFiles: ["app/api/webhooks.py"] },
  { id: "t04", watchedFiles: ["app/services/order_service.py"] },
];

describe("relevantTests", () => {
  test("a changed watched file selects its test by files", () => {
    const out = relevantTests(["app/services/payment_service.py", "README.md"], tests, []);
    expect(out.run).toEqual([{ id: "t12", selectedBy: "files" }]);
  });
  test("triage may add a test files did not select", () => {
    const out = relevantTests(["app/services/payment_service.py"], tests, ["t07"]);
    expect(out.run).toContainEqual({ id: "t07", selectedBy: "triage" });
  });
  test("triage ids that are not memory tests are ignored", () => {
    const out = relevantTests([], tests, ["nope"]);
    expect(out.run).toEqual([]);
  });
  test("everything else is skipped with a reason", () => {
    const out = relevantTests(["app/services/payment_service.py"], tests, []);
    expect(out.skipped).toEqual([
      { id: "t07", reason: "No overlap with changed files" },
      { id: "t04", reason: "No overlap with changed files" },
    ]);
  });
});

describe("faultLines", () => {
  test("counts incidents per file, most first then by path", () => {
    expect(
      faultLines([
        { watchedFiles: ["b.py", "a.py"] },
        { watchedFiles: ["a.py"] },
        { watchedFiles: ["c.ts"] },
      ]),
    ).toEqual([
      { file: "a.py", count: 2 },
      { file: "b.py", count: 1 },
      { file: "c.ts", count: 1 },
    ]);
  });
});
