import { test, expect, vi } from "vitest";

const created: Record<string, unknown>[] = [];
vi.mock("@vercel/sandbox", () => ({
  Sandbox: {
    create: async (params: Record<string, unknown>) => {
      created.push(params);
      return {
        runCommand: async () => ({ exitCode: 0, output: async () => "" }),
        update: async () => undefined,
        writeFiles: async () => undefined,
        readFileToBuffer: async () => Buffer.from(`<testsuite><testcase name="t"/></testsuite>`),
        stop: async () => undefined,
        activeCpuUsageMs: 10,
      };
    },
  },
}));

test("sandboxes are not persistent, so a stop never leaves a snapshot behind", async () => {
  const { SandboxRunner } = await import("@/lib/runner/sandbox");
  const r = await new SandboxRunner().run({ repoUrl: "https://github.com/o/r.git", sha: "abc1234", framework: "pytest", install: "true", testPath: "tests/aftershock/test_x.py", testCode: "def test_x():\n  assert True", runs: 1, timeoutMs: 1000 });
  expect(r.results[0].outcome).toBe("passed");
  expect(created[0]).toMatchObject({ persistent: false, image: "vercel/sandbox/python:3.14" });
  expect(created[0]).not.toHaveProperty("runtime");
});
