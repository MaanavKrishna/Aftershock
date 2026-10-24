/**
 * Every test framework Aftershock can prove with, in one place: how to detect it, install it,
 * run one test file to a JUnit report, where drafts live, and how to read its errors.
 */

export const q = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

export const FRAMEWORK_IDS = ["pytest", "vitest", "jest"] as const;
export type Framework = (typeof FRAMEWORK_IDS)[number];

type Read = (path: string) => Promise<string | null>;

export type FrameworkDef = {
  id: Framework;
  label: string;
  language: string;
  /** Docker image for the local runner. */
  dockerImage: string;
  /** Vercel Sandbox managed image. */
  sandboxImage: string;
  /** Install phase (network allowed), wrapping the repository's own install command. */
  setup(install: string): string;
  /** Test phase (network blocked): one file in, one JUnit report out. */
  command(testPath: string, junitPath: string): string;
  /** The same, run directly in a checkout that is already set up (CI / --in-place). */
  inPlaceCommand(testPath: string, junitPath: string): string;
  isTestFile(path: string): boolean;
  isSetupFile(path: string): boolean;
  definesTest(code: string): boolean;
  testName(code: string): string | undefined;
  /** Where a draft must live; null when the path is acceptable, else the reason. */
  checkDraftPath(path: string, testDir: string): string | null;
  /** A short instruction for the model on naming and location. */
  draftHint(testDir: string): string;
  /** Errors meaning "the code under test does not exist at this commit". */
  missingCode: RegExp;
};

const under = (path: string, testDir: string) => {
  const dir = testDir.replace(/\/$/, "");
  return path.startsWith(dir + "/") ? null : `The draft must live under ${dir}/`;
};

const pythonVenv = "(command -v uv >/dev/null 2>&1 && uv venv --seed -q .venv || python -m venv .venv)";

const pytest: FrameworkDef = {
  id: "pytest",
  label: "pytest",
  language: "Python",
  dockerImage: "python:3.12-slim",
  sandboxImage: "vercel/sandbox/python:3.14",
  setup: (install) => `${pythonVenv} && . .venv/bin/activate && ${install} && pip install -q pytest`,
  command: (t, j) => `. .venv/bin/activate && python -m pytest -q -p no:cacheprovider ${q(t)} --junitxml=${q(j)}`,
  inPlaceCommand: (t, j) => `python -m pytest -q -p no:cacheprovider ${q(t)} --junitxml=${q(j)}`,
  isTestFile: (p) => /(^|\/)(test_[^/]+|[^/]+_test)\.py$/.test(p),
  isSetupFile: (p) => /(^|\/)conftest\.py$/.test(p),
  definesTest: (code) => /^\s*(async\s+)?def test_\w+\s*\(/m.test(code),
  testName: (code) => code.match(/def (test_\w+)/)?.[1],
  checkDraftPath: (p, dir) => under(p, dir) ?? (/^(test_\w+|\w+_test)\.py$/.test(p.split("/").pop()!) ? null : "pytest drafts must be test_*.py files"),
  draftHint: (dir) => `${dir}/test_<name>.py`,
  missingCode: /collection failure|ImportError|ModuleNotFoundError|NameError|has no attribute/i,
};

const js = (id: "vitest" | "jest"): FrameworkDef => ({
  id,
  label: id,
  language: "TypeScript",
  dockerImage: "node:22-slim",
  sandboxImage: "vercel/sandbox/node:22",
  setup: (install) => (id === "jest" ? `${install} && npm install --no-save --no-audit --no-fund jest-junit` : install),
  command: (t, j) =>
    id === "vitest"
      ? `npx vitest run ${q(t)} --reporter=junit --outputFile=${q(j)}`
      : `JEST_JUNIT_OUTPUT_FILE=${q(j)} npx jest ${q(t)} --ci --reporters=default --reporters=jest-junit`,
  inPlaceCommand: (t, j) =>
    id === "vitest"
      ? `npx vitest run ${q(t)} --reporter=junit --outputFile=${q(j)}`
      : `JEST_JUNIT_OUTPUT_FILE=${q(j)} npx jest ${q(t)} --ci --reporters=default --reporters=jest-junit`,
  isTestFile: (p) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(p),
  isSetupFile: (p) => /(vitest|jest)\.config\.[cm]?[jt]s$/.test(p) || /(^|\/)setup(Tests)?\.[jt]s$/.test(p),
  definesTest: (code) => /\b(test|it)(\.each\([^)]*\))?\s*\(/.test(code),
  testName: (code) => code.match(/\b(?:test|it)\(\s*["'`]([^"'`]+)/)?.[1],
  checkDraftPath: (p, dir) => under(p, dir) ?? (/\.(test|spec)\.[cm]?[jt]sx?$/.test(p) ? null : `${id} drafts must be *.test.ts or *.test.js files`),
  draftHint: (dir) => `${dir}/<name>.test.ts`,
  missingCode: /failed to load|Cannot find module|is not a function|is not exported|does not provide an export|is not defined/i,
});

const DEFS: Record<Framework, FrameworkDef> = { pytest, vitest: js("vitest"), jest: js("jest") };

export function frameworkDef(id: Framework): FrameworkDef {
  return DEFS[id];
}

export function isFramework(x: unknown): x is Framework {
  return typeof x === "string" && (FRAMEWORK_IDS as readonly string[]).includes(x);
}

export const MISSING_CODE = new RegExp(Object.values(DEFS).map((d) => d.missingCode.source).join("|"), "i");

/** Picks the framework and install command from the repository's manifests. */
export async function detectFramework(read: Read): Promise<{ framework: Framework; install: string; language: string }> {
  const pkg = await read("package.json");
  if (pkg) {
    let deps: Record<string, unknown> = {};
    try {
      const json = JSON.parse(pkg);
      deps = { ...json.dependencies, ...json.devDependencies };
    } catch {
      // unreadable package.json: fall through to the defaults below
    }
    const lock = (await read("package-lock.json")) !== null;
    return { framework: deps.vitest ? "vitest" : "jest", install: lock ? "npm ci" : "npm install", language: "TypeScript" };
  }
  if ((await read("requirements.txt")) !== null) return { framework: "pytest", install: "pip install -r requirements.txt", language: "Python" };
  if ((await read("pyproject.toml")) !== null) return { framework: "pytest", install: "pip install -e .", language: "Python" };
  return { framework: "pytest", install: "true", language: "Python" };
}
