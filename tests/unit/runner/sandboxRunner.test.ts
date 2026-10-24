import { test, expect, vi, beforeEach } from "vitest";

const created: Record<string, unknown>[] = [];
const commands: { script: string; cwd?: string }[] = [];
const written: string[] = [];
const read: string[] = [];
const timeouts: number[] = [];
vi.mock("@vercel/sandbox", () => ({
  Sandbox: {
    create: async (params: Record<string, unknown>) => {
      created.push(params);
      return {
        runCommand: async (a: string | { args: string[]; cwd?: string }, b?: string[]) => {
          const args = typeof a === "string" ? b! : a.args;
          commands.push({ script: args[1], cwd: typeof a === "string" ? undefined : a.cwd });
          timeouts.push(typeof a === "string" ? 0 : Number((a as { timeoutMs?: number }).timeoutMs ?? 0));
          const out = args[1].includes("rev-parse --show-toplevel") ? "/vercel/aftershock-playground\n" : "";
          return { exitCode: 0, output: async () => out, stdout: async () => out };
        },
        update: async () => undefined,
        writeFiles: async (files: { path: string }[]) => void written.push(...files.map((f) => f.path)),
        readFileToBuffer: async ({ path }: { path: string }) => (read.push(path), Buffer.from(`<testsuite><testcase name="t"/></testsuite>`)),
        stop: async () => undefined,
        activeCpuUsageMs: 10,
      };
    },
  },
}));

beforeEach(() => {
  created.length = commands.length = written.length = read.length = timeouts.length = 0;
});

const spec = { repoUrl: "https://github.com/o/aftershock-playground.git", sha: "abc1234", framework: "pytest" as const, install: "pip install -r requirements.txt", testPath: "tests/aftershock/test_x.py", testCode: "def test_x():\n  assert True", runs: 1, timeoutMs: 1000 };

test("sandboxes are not persistent, so a stop never leaves a snapshot behind", async () => {
  const { SandboxRunner } = await import("@/lib/runner/sandbox");
  const r = await new SandboxRunner().run(spec);
  expect(r.results[0].outcome).toBe("passed");
  expect(created[0]).toMatchObject({ persistent: false, image: "vercel/sandbox/python:3.14" });
  expect(created[0]).not.toHaveProperty("runtime");
});

test("install, tests, files and reports all use the cloned repository, not the sandbox home", async () => {
  const { SandboxRunner } = await import("@/lib/runner/sandbox");
  await new SandboxRunner().run(spec);
  const after = commands.slice(1);
  expect(after.length).toBeGreaterThan(0);
  expect(after.every((c) => c.cwd === "/vercel/aftershock-playground")).toBe(true);
  expect(written).toEqual(["/vercel/aftershock-playground/tests/aftershock/test_x.py"]);
  expect(read[0]).toBe("/vercel/aftershock-playground/.aftershock-out/junit-0.xml");
});

test("every timeout fits the step budget, and the sandbox dies soon after it", async () => {
  process.env.AFTERSHOCK_STEP_BUDGET_MS = "60000";
  try {
    const { SandboxRunner } = await import("@/lib/runner/sandbox");
    await new SandboxRunner().run({ ...spec, timeoutMs: 120_000 });
    expect(Number(created[0].timeout)).toBeLessThanOrEqual(120_000);
    expect(timeouts.every((t) => t <= 60_000)).toBe(true);
  } finally {
    delete process.env.AFTERSHOCK_STEP_BUDGET_MS;
  }
});
