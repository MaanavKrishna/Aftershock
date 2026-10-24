import { test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// The Workflow compiler rejects a "use step" / "use workflow" directive that is not the first statement.
test('"use step" and "use workflow" are always the first statement of their function', () => {
  const dir = path.join(import.meta.dirname, "../../lib/workflows");
  const problems: string[] = [];
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".ts"))) {
    const lines = fs.readFileSync(path.join(dir, file), "utf8").split("\n");
    lines.forEach((line, i) => {
      if (!/^\s*"use (step|workflow)";\s*$/.test(line)) return;
      const prev = lines.slice(0, i).reverse().find((l) => l.trim() !== "");
      if (!prev || !/\{\s*$/.test(prev) || !/\bfunction\b|=>\s*\{\s*$/.test(prev)) problems.push(`${file}:${i + 1}`);
    });
  }
  expect(problems).toEqual([]);
});
