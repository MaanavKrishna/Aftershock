import { Sandbox } from "@vercel/sandbox";
import type { RunResult } from "@/lib/domain/verdict";
import { frameworkDef } from "./frameworks";
import { redactToken, SCRUB_GIT_CREDENTIALS } from "./secrets";
import { parseJUnit } from "./junit";
import { safeTestPath } from "./paths";
import type { RunReport, RunSpec, Runner } from "./types";

/** A hosted run must finish inside one function invocation (Vercel Hobby: about 300s). */
const stepBudgetMs = () => Number(process.env.AFTERSHOCK_STEP_BUDGET_MS ?? 270_000);
const shellQuote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;
const authedUrl = (url: string, token?: string) => (token ? url.replace(/^https:\/\//, `https://x-access-token:${token}@`) : url);
const FIND_CHECKOUT = 'for d in "$PWD" "$PWD"/*/; do git -C "$d" rev-parse --show-toplevel 2>/dev/null && break; done';

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
    const left = (want: number) => Math.max(1_000, Math.min(want, stepBudgetMs() - (Date.now() - started)));
    const common = {
      image: frameworkDef(spec.framework).sandboxImage,
      resources: { vcpus: 2 },
      // Persistent sandboxes snapshot on every stop; a one-off run must leave nothing behind.
      persistent: false,
      // If the function is cut off, the sandbox stops on its own shortly after.
      timeout: stepBudgetMs() + 60_000,
    } as const;
    const fromSnapshot = (snapshotId: string) => {
      const { image: _image, ...rest } = common;
      return Sandbox.create({ ...rest, source: { type: "snapshot", snapshotId } });
    };
    let sandbox = spec.restoreSnapshotId
      ? await fromSnapshot(spec.restoreSnapshotId)
      : await Sandbox.create({
          ...common,
          source: spec.token
            ? { type: "git", url: spec.repoUrl, username: "x-access-token", password: spec.token, revision: spec.sha, depth: 1 }
            : { type: "git", url: spec.repoUrl, revision: spec.sha, depth: 1 },
        });
    const logs: string[] = [];
    let snapshot: RunReport["snapshot"];
    try {
      // Image-based sandboxes clone into a folder under the home directory; everything runs inside the checkout.
      const locate = async () => {
        const found = await sandbox.runCommand("sh", ["-c", FIND_CHECKOUT], { timeoutMs: 30_000 });
        const dir = (await found.output("stdout")).trim().split("\n")[0];
        if (!dir.startsWith("/")) throw new Error("The repository checkout was not found in the sandbox");
        return dir;
      };
      let root = await locate();
      const sh = (script: string, timeoutMs: number) => sandbox.runCommand({ cmd: "sh", args: ["-c", script], cwd: root, timeoutMs: left(timeoutMs) });
      const at = (p: string) => `${root}/${p}`;

      if (spec.restoreSnapshotId) {
        // Cached environment: bring the checkout to this exact commit; dependencies are already installed.
        const fetched = await sh(`git fetch -q --depth 1 ${shellQuote(authedUrl(spec.repoUrl, spec.token))} ${shellQuote(spec.sha)} && git checkout -q -f FETCH_HEAD`, 120_000);
        await sh(SCRUB_GIT_CREDENTIALS, 30_000);
        if (fetched.exitCode !== 0) {
          await sandbox.stop().catch(() => undefined);
          return this.run({ ...spec, restoreSnapshotId: undefined, saveSnapshot: false });
        }
        logs.push(`$ restored dependencies from cache`);
      } else {
        await sh(SCRUB_GIT_CREDENTIALS, 30_000);
        const install = await sh(frameworkDef(spec.framework).setup(spec.install), 15 * 60_000);
        logs.push(`$ ${spec.install}\n${(await install.output("both")).slice(-4000)}`);
        if (install.exitCode !== 0) {
          return { installOk: false, results: Array.from({ length: spec.runs }, () => ({ outcome: "error" as const, durationMs: 0, message: `Dependency install failed (exit ${install.exitCode})` })), log: redactToken(logs.join("\n\n"), spec.token), cpuMs: sandbox.activeCpuUsageMs ?? 0, wallMs: Date.now() - started };
        }
        if (spec.saveSnapshot) {
          // snapshot() stops this sandbox; tests continue in a fresh one restored from it.
          const snap = await sandbox.snapshot({ expiration: 7 * 24 * 60 * 60_000 });
          snapshot = { id: snap.snapshotId, sizeBytes: snap.sizeBytes ?? 0 };
          sandbox = await fromSnapshot(snap.snapshotId);
          root = await locate();
        }
      }
      await sandbox.update({ networkPolicy: "deny-all" });
      await sandbox.writeFiles([{ path: at(testPath), content: spec.testCode }, ...[...(spec.overlay ?? []), ...(frameworkDef(spec.framework).supportFiles ?? [])].map((o) => ({ path: at(safeTestPath(o.path)), content: o.content }))]);
      const results: RunResult[] = [];
      for (let i = 0; i < spec.runs; i++) {
        const junit = `.aftershock-out/junit-${i}.xml`;
        const t0 = Date.now();
        let exit: number | null = null;
        let out = "";
        let timedOut = false;
        try {
          const r = await sh(`mkdir -p .aftershock-out && ${frameworkDef(spec.framework).command(testPath, junit)}`, spec.timeoutMs);
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
        const xml = await sandbox.readFileToBuffer({ path: at(junit) });
        results.push(parseJUnit(redactToken(xml ? xml.toString("utf8") : "", spec.token), ms));
      }
      const report = { snapshot, installOk: true, results, log: redactToken(logs.join("\n\n"), spec.token), cpuMs: sandbox.activeCpuUsageMs ?? Date.now() - started, wallMs: Date.now() - started };
      (await import("@/lib/obs/log")).log.info("sandbox run finished", { sha: spec.sha.slice(0, 12), framework: spec.framework, outcomes: results.map((r) => r.outcome), wallMs: report.wallMs });
      return report;
    } finally {
      await sandbox.stop().catch(() => undefined);
    }
  }
}
