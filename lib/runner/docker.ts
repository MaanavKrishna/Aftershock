import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { RunResult } from "@/lib/domain/verdict";
import { commandFor, imageFor, setupFor } from "./adapters";
import { parseJUnit } from "./junit";
import type { RunReport, RunSpec, Runner } from "./types";
import { safeTestPath } from "./paths";

type Exec = { code: number | null; out: string; timedOut: boolean; ms: number };

const TAIL = 16_000;

function exec(cmd: string, args: string[], opts: { timeoutMs: number; input?: Buffer; cwd?: string; onTimeout?: () => void }): Promise<Exec> {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(cmd, args, { cwd: opts.cwd, stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    const take = (b: Buffer) => {
      out = (out + b.toString("utf8")).slice(-TAIL);
    };
    child.stdout.on("data", take);
    child.stderr.on("data", take);
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      opts.onTimeout?.();
      child.kill("SIGKILL");
    }, opts.timeoutMs);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, out, timedOut, ms: Date.now() - started });
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ code: -1, out: String(err), timedOut, ms: Date.now() - started });
    });
    if (opts.input) child.stdin.end(opts.input);
    else child.stdin.end();
  });
}

const isLocal = (url: string) => url.startsWith("/") || url.startsWith("file://");

/** Exports exactly one commit's files into dest, without a .git directory. */
async function exportCommit(repoUrl: string, sha: string, token: string | undefined, dest: string): Promise<void> {
  if (!/^[0-9a-f]{7,40}$/i.test(sha) && !/^[A-Za-z0-9._/-]{1,100}$/.test(sha)) throw new Error("Invalid commit reference");
  let gitDir: string;
  if (isLocal(repoUrl)) {
    gitDir = repoUrl.replace(/^file:\/\//, "");
  } else {
    const cache = path.join(os.homedir(), ".cache", "aftershock", "repos", createHash("sha1").update(repoUrl).digest("hex"));
    const auth = token ? ["-c", `http.extraHeader=Authorization: Basic ${Buffer.from(`x-access-token:${token}`).toString("base64")}`] : [];
    if (!fs.existsSync(cache)) {
      fs.mkdirSync(path.dirname(cache), { recursive: true });
      const c = await exec("git", [...auth, "clone", "--quiet", "--bare", "--filter=blob:none", repoUrl, cache], { timeoutMs: 300_000 });
      if (c.code !== 0) throw new Error("Could not clone the repository");
    }
    const f = await exec("git", [...auth, "-C", cache, "fetch", "--quiet", "origin", sha], { timeoutMs: 300_000 });
    if (f.code !== 0) {
      const has = await exec("git", ["-C", cache, "cat-file", "-e", `${sha}^{commit}`], { timeoutMs: 30_000 });
      if (has.code !== 0) throw new Error(`Commit ${sha} could not be fetched`);
    }
    gitDir = cache;
  }
  const archive = path.join(dest, "..", `${path.basename(dest)}.tar`);
  const a = await exec("git", ["-C", gitDir, "archive", "--format=tar", "-o", archive, sha], { timeoutMs: 120_000 });
  if (a.code !== 0) throw new Error(`Commit ${sha} does not exist in the repository`);
  fs.mkdirSync(dest, { recursive: true });
  const x = await exec("tar", ["-xf", archive, "-C", dest], { timeoutMs: 120_000 });
  fs.rmSync(archive, { force: true });
  if (x.code !== 0) throw new Error("Could not unpack the commit");
}

/**
 * Local runner: each commit is exported to a temporary folder, dependencies are installed in a
 * throwaway container with network, then the test runs in fresh containers with --network none.
 */
export class DockerRunner implements Runner {
  kind = "docker" as const;

  async run(spec: RunSpec): Promise<RunReport> {
    const testPath = safeTestPath(spec.testPath);
    const started = Date.now();
    const root = process.env.AFTERSHOCK_WORK_DIR ?? path.join(os.homedir(), ".cache", "aftershock", "runs");
    fs.mkdirSync(root, { recursive: true });
    // Under the home folder: Docker Desktop and Colima both share it with containers; the OS temp dir is not always shared.
    const base = fs.realpathSync(fs.mkdtempSync(path.join(root, "run-")));
    const work = path.join(base, "w");
    const logs: string[] = [];
    try {
      await exportCommit(spec.repoUrl, spec.sha, spec.token, work);
      const target = path.join(work, testPath);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, spec.testCode);
      for (const o of spec.overlay ?? []) {
        const file = path.join(work, safeTestPath(o.path));
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, o.content);
      }
      fs.mkdirSync(path.join(work, ".aftershock-out"), { recursive: true });

      const image = imageFor(spec.framework);
      const user = process.platform === "linux" && typeof process.getuid === "function" ? ["--user", `${process.getuid()}:${process.getgid!()}`] : [];
      const common = ["run", "--rm", ...user, "-e", "HOME=/tmp", "-e", "CI=1", "-v", `${work}:/w`, "-w", "/w", "--memory", "2g", "--cpus", "2"];

      const install = await exec("docker", [...common, image, "sh", "-c", setupFor(spec.framework, spec.install)], { timeoutMs: 15 * 60_000 });
      logs.push(`$ ${spec.install}\n${install.out.slice(-4000)}`);
      if (install.code !== 0) {
        const message = install.timedOut ? "Dependency install timed out" : `Dependency install failed (exit ${install.code})`;
        return { installOk: false, results: Array.from({ length: spec.runs }, () => ({ outcome: "error", durationMs: 0, message })), log: logs.join("\n\n"), cpuMs: 0, wallMs: Date.now() - started };
      }

      const results: RunResult[] = [];
      let testMs = 0;
      for (let i = 0; i < spec.runs; i++) {
        const junit = `.aftershock-out/junit-${i}.xml`;
        const name = `aftershock-${randomUUID().slice(0, 12)}`;
        const r = await exec("docker", [...common, "--name", name, "--network", "none", image, "sh", "-c", commandFor(spec.framework, testPath, `/w/${junit}`)], {
          timeoutMs: spec.timeoutMs,
          onTimeout: () => void exec("docker", ["rm", "-f", name], { timeoutMs: 30_000 }),
        });
        testMs += r.ms;
        if (i === 0 || r.code !== 0) logs.push(`$ run ${i + 1}\n${r.out.slice(-3000)}`);
        if (r.timedOut) {
          results.push({ outcome: "error", durationMs: r.ms, message: `Test exceeded the ${Math.round(spec.timeoutMs / 1000)}s time limit` });
          continue;
        }
        const file = path.join(work, junit);
        results.push(parseJUnit(fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "", r.ms));
      }
      return { installOk: true, results, log: logs.join("\n\n"), cpuMs: testMs, wallMs: Date.now() - started };
    } finally {
      fs.rmSync(base, { recursive: true, force: true });
    }
  }
}
