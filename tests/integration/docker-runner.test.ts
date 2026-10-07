import { describe, test, expect, beforeAll } from "vitest";
import { DockerRunner } from "@/lib/runner/docker";
import { makeLedgerRepo, LEDGER_TEST, dockerAvailable } from "../support/fixtureRepo";

const hasDocker = dockerAvailable();

describe.skipIf(!hasDocker)("Docker runner", () => {
  let repo: ReturnType<typeof makeLedgerRepo>;
  beforeAll(() => {
    repo = makeLedgerRepo();
  });
  const spec = (sha: string, testCode = LEDGER_TEST) => ({
    repoUrl: repo.dir, sha, framework: "pytest" as const, install: "pip install -q -r requirements.txt", testPath: "tests/aftershock/test_ledger.py", testCode, runs: 2, timeoutMs: 60_000,
  });

  test("the draft fails on the commit before the fix", async () => {
    const r = await new DockerRunner().run(spec(repo.parent));
    expect(r.installOk).toBe(true);
    expect(r.results.map((x) => x.outcome)).toEqual(["failed", "failed"]);
  }, 300_000);

  test("the draft passes on the fix", async () => {
    const r = await new DockerRunner().run(spec(repo.fix));
    expect(r.results.map((x) => x.outcome)).toEqual(["passed", "passed"]);
  }, 300_000);

  test("a draft importing something that does not exist is an environment error", async () => {
    const r = await new DockerRunner().run(spec(repo.parent, "from ledger import refund\n\ndef test_x():\n    assert refund(1)\n"));
    expect(r.results.every((x) => x.outcome === "error")).toBe(true);
  }, 300_000);

  test("a broken install marks every run as an error", async () => {
    const r = await new DockerRunner().run({ ...spec(repo.fix), install: "pip install -q this-package-does-not-exist-aftershock==9.9.9" });
    expect(r.installOk).toBe(false);
    expect(r.results.every((x) => x.outcome === "error")).toBe(true);
  }, 300_000);

  test("a test that hangs is stopped and counted as an error", async () => {
    const r = await new DockerRunner().run({ ...spec(repo.fix, "import time\n\ndef test_hang():\n    time.sleep(600)\n"), runs: 1, timeoutMs: 8_000 });
    expect(r.results[0].outcome).toBe("error");
    expect(r.results[0].message).toMatch(/time/i);
  }, 300_000);

  test("the test path must stay inside the repository", async () => {
    await expect(new DockerRunner().run({ ...spec(repo.fix), testPath: "../escape.py" })).rejects.toThrow(/test path/i);
  });
});
