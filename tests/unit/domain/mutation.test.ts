import { describe, test, expect } from "vitest";
import { mutantsFor, strengthOf } from "@/lib/domain/mutation";

const parent = "def pay(order_id):\n    PAYMENTS.append(order_id)\n    return 201\n";
const fix = "def pay(order_id):\n    if order_id in PAYMENTS:\n        return 400\n    PAYMENTS.append(order_id)\n    return 201\n";

describe("mutantsFor", () => {
  test("mutates only the lines the fix added, one change per mutant", () => {
    const ms = mutantsFor("ledger.py", parent, fix);
    expect(ms.length).toBeGreaterThan(0);
    for (const m of ms) {
      expect([2, 3]).toContain(m.line);
      const lines = m.content.split("\n");
      const orig = fix.split("\n");
      expect(lines.filter((l, i) => l !== orig[i])).toHaveLength(1);
    }
    expect(ms.map((m) => m.to)).toContain("    if order_id not in PAYMENTS:");
    expect(ms.some((m) => m.to.includes("return 401") || m.to.includes("return 399"))).toBe(true);
  });
  test("comparison, boolean and arithmetic operators flip", () => {
    const p = "x = 1\n";
    const f = "if a <= b and ok:\n    return total + fee\nx = True\n";
    const tos = mutantsFor("a.py", p, f).map((m) => m.to);
    expect(tos).toContain("if a < b and ok:");
    expect(tos).toContain("if a <= b or ok:");
    expect(tos).toContain("    return total - fee");
    expect(tos).toContain("x = False");
  });
  test("comments, blank lines and imports are left alone; at most 8 mutants per file", () => {
    const f = "import x\n# a < b\n\n" + Array.from({ length: 20 }, (_, i) => `v${i} = a < b`).join("\n") + "\n";
    const ms = mutantsFor("a.py", "", f);
    expect(ms.every((m) => !m.from.startsWith("import") && !m.from.startsWith("#"))).toBe(true);
    expect(ms.length).toBeLessThanOrEqual(8);
  });
  test("a fix that only deletes lines has nothing to mutate", () => {
    expect(mutantsFor("a.py", fix, parent)).toEqual([]);
  });
});

describe("strengthOf", () => {
  test("killed over total, rounded, with survivors listed", () => {
    const s = strengthOf([{ file: "a.py", line: 2, from: "a", to: "b", killed: true }, { file: "a.py", line: 3, from: "c", to: "d", killed: false }, { file: "a.py", line: 3, from: "c", to: "e", killed: true }]);
    expect(s).toMatchObject({ killed: 2, total: 3, score: 67, survivors: [{ file: "a.py", line: 3, from: "c", to: "d" }] });
  });
});
