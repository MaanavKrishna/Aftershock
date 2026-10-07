import { test, expect } from "vitest";
import fs from "node:fs";
import { parseJUnit } from "@/lib/runner/junit";

const fx = (n: string) => fs.readFileSync(`tests/fixtures/junit/${n}.xml`, "utf8");

test("a passing testcase is passed", () => {
  expect(parseJUnit(fx("pass"), 800).outcome).toBe("passed");
});
test("an assertion failure is failed, with its message", () => {
  const r = parseJUnit(fx("fail"), 840);
  expect(r.outcome).toBe("failed");
  expect(r.message).toBe("assert 201 == 400");
});
test("a collection or import error is an environment error, never a reproduction", () => {
  const r = parseJUnit(fx("error"), 100);
  expect(r.outcome).toBe("error");
  expect(r.message).toMatch(/collection failure|ImportError/);
});
test("vitest failures are failed", () => {
  expect(parseJUnit(fx("vitest-fail"), 300).outcome).toBe("failed");
});
test("an empty or missing report is an error", () => {
  expect(parseJUnit("", 0).outcome).toBe("error");
  expect(parseJUnit("<testsuites></testsuites>", 0).outcome).toBe("error");
});
test("a skipped test is an error, not a pass", () => {
  expect(parseJUnit('<testsuite><testcase name="t"><skipped/></testcase></testsuite>', 0).outcome).toBe("error");
});
test("numeric character references in failure messages are decoded", () => {
  const xml = `<testsuite><testcase name="t"><failure message="AssertionError: assert -1000 == 0&#10; +  where -1000 = total_cents()&#x27;x&#x27;">x</failure></testcase></testsuite>`;
  expect(parseJUnit(xml, 0).message).toBe("AssertionError: assert -1000 == 0\n +  where -1000 = total_cents()'x'");
});
