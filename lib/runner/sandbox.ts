import { Sandbox } from "@vercel/sandbox";
import type { RunResult } from "@/lib/domain/verdict";
import { commandFor, setupFor } from "./adapters";
import { parseJUnit } from "./junit";
import { safeTestPath } from "./paths";
import type { RunReport, RunSpec, Runner } from "./types";

const SANDBOX_TIMEOUT_MS = 45 * 60_000;

/**
 * Vercel Sandbox: one Firecracker microVM per call. Clone one commit, install with network,
 * cut the network, run the test N times, stop the VM. No secrets are passed in.
 */
export class SandboxRunner implements Runner {
  kind = "sandbox" as const;

  async run(spec: RunSpec): Promise<RunReport> {
    if (spec.repoUrl.startsWith("/") || spec.repoUrl.startsWith("file://")) throw new Error("The sandbox can only clone remote repositories");
    const testPath = safeTestPath(spec.testPath);
    const started = Date.now();
    const sandbox = await Sandbox.create({
      source: spec.token
        ? { type: "git", url: spec.repoUrl, username: "x-access-token", password: spec.token, revision: spec.sha, depth: 1 }
        : { type: "git", url: spec.repoUrl, revision: spec.sha, depth: 1 },
      runtime: spec.framework === "pytest" ? "python3.13" : "node22",
      resources: { vcpus: 2 },
      timeout: SANDBOX_TIMEOUT_MS,
    });
    const logs: string[] = [];
    try {
      const sh = (script: string, timeoutMs: number) => sandbox.runCommand("sh", ["-c", script], { timeoutMs });
      const install = await sh(setupFor(spec.framework, spec.install), 15 * 60_000);
      logs.push(`$ ${spec.install}\n${(await install.output("both")).slice(-4000)}`);
      if (install.exitCode !== 0) {
        return { installOk: false, results: Array.from({ length: spec.runs }, () => ({ outcome: "error" as const, durationMs: 0, message: `Dependency install failed (exit ${install.exitCode})` })), log: logs.join("\n\n"), cpuMs: sandbox.activeCpuUsageMs ?? 0, wallMs: Date.now() - started };
      }
      await sandbox.updateNetworkPolicy("deny-all");
      await sandbox.writeFiles([{ path: testPath, content: spec.testCode }, ...(spec.overlay ?? []).map((o) => ({ path: safeTestPath(o.path), content: o.content }))]);
      const results: RunResult[] = [];
      for (let i = 0; i < spec.runs; i++) {
        const junit = `.aftershock-out/junit-${i}.xml`;
        const t0 = Date.now();
        let exit: number | null = null;
        let out = "";
        let timedOut = false;
        try {
          const r = await sh(`mkdir -p .aftershock-out && ${commandFor(spec.framework, testPath, junit)}`, spec.timeoutMs);
          exit = r.exitCode;
          out = await r.output("both");
        } catch {
          timedOut = true;
        }
        const ms = Date.now() - t0;
        if (i === 0 || exit !== 0) logs.push(`$ run ${i + 1}\n${out.slice(-3000)}`);
        if (timedOut) {
          results.push({ outcome: "error", durationMs: ms, message: `Test exceeded the ${Math.round(spec.timeoutMs / 1000)}s time limit` });
          continue;
        }
        const xml = await sandbox.readFileToBuffer({ path: junit });
        results.push(parseJUnit(xml ? xml.toString("utf8") : "", ms));
      }
      return { installOk: true, results, log: logs.join("\n\n"), cpuMs: sandbox.activeCpuUsageMs ?? Date.now() - started, wallMs: Date.now() - started };
    } finally {
      await sandbox.stop().catch(() => undefined);
    }
  }
}
