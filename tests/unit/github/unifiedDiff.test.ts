import { test, expect } from "vitest";
import { unifiedDiff } from "@/lib/github/suggest";

test("unifiedDiff renders a git-style patch with the file's path", () => {
  const d = unifiedDiff("app/pay.py", "a\nb\nc\n", "a\nB\nc\n");
  expect(d).toContain("--- a/app/pay.py");
  expect(d).toContain("+++ b/app/pay.py");
  expect(d).toContain("-b\n+B");
  expect(d).not.toContain("Index:");
});

test("unifiedDiff is empty when nothing changed", () => {
  expect(unifiedDiff("x.py", "same\n", "same\n")).toBe("");
});
