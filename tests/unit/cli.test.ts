import { test, expect } from "vitest";
import { parseArgs, exitCodeForCheck, exitCodeForProve } from "@/cli/args";

test("prove needs a fix commit and a test file", () => {
  expect(parseArgs(["prove", "--fix", "aa86f56", "--test", "tests/aftershock/test_x.py"])).toMatchObject({ command: "prove", fix: "aa86f56", test: "tests/aftershock/test_x.py", repo: ".", runs: 3 });
  expect(() => parseArgs(["prove", "--test", "t.py"])).toThrow(/--fix/);
});

test("check defaults to the memory test folder and HEAD", () => {
  expect(parseArgs(["check"])).toMatchObject({ command: "check", head: "HEAD", tests: "tests/aftershock", inPlace: false });
  expect(parseArgs(["check", "--in-place", "--pr", "214", "--report"])).toMatchObject({ inPlace: true, pr: 214, report: true });
});

test("verify takes an incident key", () => {
  expect(parseArgs(["verify", "INC-12"])).toMatchObject({ command: "verify", incident: 12 });
  expect(() => parseArgs(["verify", "twelve"])).toThrow(/incident/i);
});

test("unknown commands and flags are errors", () => {
  expect(() => parseArgs(["deploy"])).toThrow(/Unknown command/);
  expect(() => parseArgs(["check", "--nope"])).toThrow(/Unknown option/);
});

test("runs must be between 1 and 10", () => {
  expect(() => parseArgs(["prove", "--fix", "a1b2c3d", "--test", "t.py", "--runs", "0"])).toThrow(/runs/);
});

test("check exit codes: recur 1, inconclusive 2, otherwise 0", () => {
  expect(exitCodeForCheck(["safe", "recur"])).toBe(1);
  expect(exitCodeForCheck(["safe", "inconclusive"])).toBe(2);
  expect(exitCodeForCheck(["safe", "skipped"])).toBe(0);
  expect(exitCodeForCheck([])).toBe(0);
});

test("prove exit codes: proven 0, anything else 2", () => {
  expect(exitCodeForProve("proven")).toBe(0);
  expect(exitCodeForProve("rejected")).toBe(2);
  expect(exitCodeForProve("unproven")).toBe(2);
});
