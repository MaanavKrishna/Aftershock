import { test, expect } from "vitest";
import { commandFor, imageFor, setupFor } from "@/lib/runner/adapters";
import { pickRunner } from "@/lib/runner/select";

test("pytest runs one file with a junit report", () => {
  expect(commandFor("pytest", "tests/aftershock/test_x.py", "/w/.as/junit.xml")).toContain("pytest -q -p no:cacheprovider 'tests/aftershock/test_x.py' --junitxml='/w/.as/junit.xml'");
});
test("vitest and jest emit junit", () => {
  expect(commandFor("vitest", "t.test.ts", "/j.xml")).toContain("--reporter=junit --outputFile='/j.xml'");
  expect(commandFor("jest", "t.test.ts", "/j.xml")).toContain("JEST_JUNIT_OUTPUT_FILE='/j.xml'");
});
test("paths are shell-quoted so a hostile path cannot inject commands", () => {
  expect(commandFor("pytest", "x'; rm -rf / #.py", "/j.xml")).toContain(`'x'\\''; rm -rf / #.py'`);
});
test("images and setup per framework", () => {
  expect(imageFor("pytest")).toMatch(/^python:3\.12/);
  expect(imageFor("jest")).toMatch(/^node:22/);
  expect(setupFor("pytest", "pip install -r requirements.txt")).toContain("python -m venv .venv");
  expect(setupFor("jest", "npm ci")).toContain("jest-junit");
});
test("pickRunner honours the repo choice and the sandbox allowance", () => {
  expect(pickRunner({ runner: "sandbox" }, { remainingCpuMs: 1000 }, false)).toBe("sandbox");
  expect(pickRunner({ runner: "actions" }, { remainingCpuMs: 1000 }, false)).toBe("actions");
  expect(pickRunner({ runner: "sandbox" }, { remainingCpuMs: 0 }, true)).toBe("actions");
  expect(pickRunner({ runner: "sandbox" }, { remainingCpuMs: 0 }, false)).toBe("unavailable");
});
