import type { Framework } from "./types";

export const q = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

export function imageFor(f: Framework): string {
  return f === "pytest" ? "python:3.12-slim" : "node:22-slim";
}

/** Install phase (network allowed). */
export function setupFor(f: Framework, install: string): string {
  if (f === "pytest") return `python -m venv .venv && . .venv/bin/activate && ${install} && pip install -q pytest`;
  if (f === "jest") return `${install} && npm install --no-save --no-audit --no-fund jest-junit`;
  return install;
}

/** Test phase (network blocked). One file, one JUnit report. */
export function commandFor(f: Framework, testPath: string, junitPath: string): string {
  if (f === "pytest") return `. .venv/bin/activate && python -m pytest -q -p no:cacheprovider ${q(testPath)} --junitxml=${q(junitPath)}`;
  if (f === "vitest") return `npx vitest run ${q(testPath)} --reporter=junit --outputFile=${q(junitPath)}`;
  return `JEST_JUNIT_OUTPUT_FILE=${q(junitPath)} npx jest ${q(testPath)} --ci --reporters=default --reporters=jest-junit`;
}
