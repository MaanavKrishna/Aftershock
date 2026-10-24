import { test, expect } from "vitest";
import { FRAMEWORK_IDS, frameworkDef, isFramework, detectFramework, MISSING_CODE } from "@/lib/runner/frameworks";

const reader = (files: Record<string, string>) => async (p: string) => files[p] ?? null;

test("the registry knows every framework and rejects others", () => {
  expect(FRAMEWORK_IDS).toEqual(expect.arrayContaining(["pytest", "vitest", "jest"]));
  expect(isFramework("pytest")).toBe(true);
  expect(isFramework("cobol")).toBe(false);
});

test("detection reads the repository's manifests", async () => {
  expect(await detectFramework(reader({ "package.json": JSON.stringify({ devDependencies: { vitest: "3" } }), "package-lock.json": "{}" }))).toEqual({ framework: "vitest", install: "npm ci", language: "TypeScript" });
  expect(await detectFramework(reader({ "package.json": JSON.stringify({ devDependencies: { jest: "29" } }) }))).toEqual({ framework: "jest", install: "npm install", language: "TypeScript" });
  expect(await detectFramework(reader({ "requirements.txt": "pytest" }))).toEqual({ framework: "pytest", install: "pip install -r requirements.txt", language: "Python" });
  expect(await detectFramework(reader({ "pyproject.toml": "[project]" }))).toEqual({ framework: "pytest", install: "pip install -e .", language: "Python" });
});

test("sandbox images use managed images, not deprecated runtimes", () => {
  expect(frameworkDef("pytest").sandboxImage).toBe("vercel/sandbox/python:3.14");
  expect(frameworkDef("vitest").sandboxImage).toBe("vercel/sandbox/node:22");
});

test("test files, setup files and test names per framework", () => {
  const py = frameworkDef("pytest");
  expect(py.isTestFile("tests/test_cart.py")).toBe(true);
  expect(py.isTestFile("shop/cart.py")).toBe(false);
  expect(py.isSetupFile("tests/conftest.py")).toBe(true);
  expect(py.testName("def test_total(cart):\n  pass")).toBe("test_total");
  const vt = frameworkDef("vitest");
  expect(vt.isTestFile("src/cart.test.ts")).toBe(true);
  expect(vt.isSetupFile("vitest.config.ts")).toBe(true);
  expect(vt.testName(`it("keeps totals positive", () => {})`)).toBe("keeps totals positive");
});

test("draft paths follow each framework's layout", () => {
  const py = frameworkDef("pytest");
  expect(py.checkDraftPath("tests/aftershock/test_x.py", "tests/aftershock")).toBeNull();
  expect(py.checkDraftPath("tests/aftershock/x.py", "tests/aftershock")).toMatch(/test_\*\.py/);
  expect(py.checkDraftPath("src/test_x.py", "tests/aftershock")).toMatch(/under tests\/aftershock/);
  expect(frameworkDef("jest").checkDraftPath("tests/aftershock/x.test.ts", "tests/aftershock")).toBeNull();
  expect(py.definesTest("def test_a():\n  assert 1")).toBe(true);
  expect(frameworkDef("vitest").definesTest("const x = 1")).toBe(false);
});

test("missing-code errors cover every language", () => {
  expect(MISSING_CODE.test("ModuleNotFoundError: No module named 'x'")).toBe(true);
  expect(MISSING_CODE.test("Cannot find module './cart'")).toBe(true);
  expect(MISSING_CODE.test("assert 1 == 2")).toBe(false);
});
