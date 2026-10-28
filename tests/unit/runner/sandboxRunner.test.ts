import { test, expect, vi, beforeEach } from "vitest";

const created: Record<string, unknown>[] = [];
const commands: { script: string; cwd?: string }[] = [];
const written: string[] = [];
const read: string[] = [];
const timeouts: number[] = [];
const events: string[] = [];
const fail = { snapshot: false };
vi.mock("@vercel/sandbox", () => ({
  Sandbox: {
    create: async (params: Record<string, unknown>) => {
      created.push(params);
      events.push(`create:${(params.source as { type: string }).type}`);
      return {
        runCommand: async (a: string | { args: string[]; cwd?: string }, b?: string[]) => {
          const args = typeof a === "string" ? b! : a.args;
          commands.push({ script: args[1], cwd: typeof a === "string" ? undefined : a.cwd });
          timeouts.push(typeof a === "string" ? 0 : Number((a as { timeoutMs?: number }).timeoutMs ?? 0));
          events.push(`cmd:${args[1].slice(0, 200)}`);
          const out = args[1].includes("rev-parse --show-toplevel") ? "/vercel/aftershock-playground\n" : "";
          return { exitCode: 0, output: async () => out, stdout: async () => out };
        },
        update: async (u: { networkPolicy?: string }) => void events.push(`network:${u.networkPolicy}`),
        snapshot: async () => {
          events.push("snapshot");
          if (fail.snapshot) throw Object.assign(new Error("Status code 402 is not ok: Hobby plan usage limit exceeded for Snapshots Storage"), { status: 402 });
          return { snapshotId: "snap_new", sizeBytes: 123 };
        },
        writeFiles: async (files: { path: string }[]) => void written.push(...files.map((f) => f.path)),
        readFileToBuffer: async ({ path }: { path: string }) => (read.push(path), Buffer.from(`<testsuite><testcase name="t"/></testsuite>`)),
        stop: async () => undefined,
        activeCpuUsageMs: 10,
      };
    },
  },
}));

beforeEach(() => {
  fail.snapshot = false;
  created.length = commands.length = written.length = read.length = timeouts.length = events.length = 0;
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

test("a cache miss installs, snapshots, restores, and only then cuts the network and runs", async () => {
  const { SandboxRunner } = await import("@/lib/runner/sandbox");
  const r = await new SandboxRunner().run({ ...spec, saveSnapshot: true });
  expect(r.snapshot).toEqual({ id: "snap_new", sizeBytes: 123 });
  const order = events.filter((e) => /^(create|snapshot|network)/.test(e) || e.includes("pip install") || e.includes("python -m pytest"));
  expect(order[0]).toBe("create:git");
  expect(order.indexOf("snapshot")).toBeGreaterThan(order.findIndex((e) => e.includes("pip install")));
  expect(order.indexOf("create:snapshot")).toBeGreaterThan(order.indexOf("snapshot"));
  expect(order.indexOf("network:deny-all")).toBeGreaterThan(order.indexOf("create:snapshot"));
  expect(order.findIndex((e) => e.includes("python -m pytest"))).toBeGreaterThan(order.indexOf("network:deny-all"));
  expect(created[1]).toMatchObject({ source: { type: "snapshot", snapshotId: "snap_new" }, persistent: false });
});

test("a cache hit restores, fetches the exact commit, skips install, and cuts the network before tests", async () => {
  const { SandboxRunner } = await import("@/lib/runner/sandbox");
  await new SandboxRunner().run({ ...spec, restoreSnapshotId: "snap_old", token: "ghs_secret_token_value_1234" });
  expect(created[0]).toMatchObject({ source: { type: "snapshot", snapshotId: "snap_old" } });
  expect(events.some((e) => e.includes("pip install"))).toBe(false);
  const fetchAt = events.findIndex((e) => e.startsWith("cmd:git fetch"));
  expect(fetchAt).toBeGreaterThan(-1);
  expect(commands.find((c) => c.script.startsWith("git fetch"))!.script).toContain("abc1234");
  expect(events.indexOf("network:deny-all")).toBeGreaterThan(fetchAt);
  expect(events.findIndex((e) => e.includes("python -m pytest"))).toBeGreaterThan(events.indexOf("network:deny-all"));
});

test("in a monorepo package, commands run in the package and the test path is relative to it", async () => {
  const { SandboxRunner } = await import("@/lib/runner/sandbox");
  await new SandboxRunner().run({ ...spec, workdir: "services/api", testPath: "services/api/tests/aftershock/test_x.py" });
  const after = commands.slice(1);
  expect(after.filter((c) => c.script.startsWith("git ")).every((c) => c.cwd === "/vercel/aftershock-playground")).toBe(true);
  expect(after.filter((c) => !c.script.startsWith("git ")).every((c) => c.cwd === "/vercel/aftershock-playground/services/api")).toBe(true);
  expect(written[0]).toBe("/vercel/aftershock-playground/services/api/tests/aftershock/test_x.py");
  const testCmd = commands.find((c) => c.script.includes("python -m pytest"))!.script;
  expect(testCmd).toContain("'tests/aftershock/test_x.py'");
  expect(read[0]).toBe("/vercel/aftershock-playground/services/api/.aftershock-out/junit-0.xml");
});

test("when saving the install snapshot fails (for example a storage quota), the run still happens, uncached", async () => {
  fail.snapshot = true;
  const { SandboxRunner } = await import("@/lib/runner/sandbox");
  const r = await new SandboxRunner().run({ ...spec, saveSnapshot: true });
  expect(r.results[0].outcome).toBe("passed");
  expect(r.snapshot).toBeUndefined();
  expect(events).toContain("network:deny-all");
  expect(created.every((c) => (c.source as { type: string }).type !== "snapshot")).toBe(true);
});
