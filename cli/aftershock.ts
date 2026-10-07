import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parseArgs, exitCodeForCheck, exitCodeForProve, type Framework } from "./args";
import { DockerRunner } from "@/lib/runner/docker";
import { commandFor, setupFor } from "@/lib/runner/adapters";
import { parseJUnit } from "@/lib/runner/junit";
import { decideAdmission } from "@/lib/domain/admission";
import { prVerdict, type RunResult } from "@/lib/domain/verdict";

const out = (s: string) => process.stdout.write(s + "\n");
const git = (repo: string, ...a: string[]) => execFileSync("git", ["-C", repo, ...a], { encoding: "utf8" }).trim();

function detect(repo: string, framework?: Framework, install?: string): { framework: Framework; install: string } {
  if (framework) return { framework, install: install ?? (framework === "pytest" ? "pip install -r requirements.txt" : "npm ci") };
  const has = (f: string) => fs.existsSync(path.join(repo, f));
  if (has("package.json")) {
    const pkg = JSON.parse(fs.readFileSync(path.join(repo, "package.json"), "utf8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const fw: Framework = deps.vitest ? "vitest" : "jest";
    return { framework: fw, install: install ?? (has("package-lock.json") ? "npm ci" : "npm install") };
  }
  return { framework: "pytest", install: install ?? (has("requirements.txt") ? "pip install -r requirements.txt" : has("pyproject.toml") ? "pip install -e ." : "true") };
}

const fmt = (rs: RunResult[]) => rs.map((r) => (r.outcome === "passed" ? "pass" : r.outcome === "failed" ? "FAIL" : "error")).join(" ");

async function prove(a: Extract<ReturnType<typeof parseArgs>, { command: "prove" }>) {
  const repo = path.resolve(a.repo);
  const fix = git(repo, "rev-parse", `${a.fix}^{commit}`);
  let parent: string;
  try {
    parent = git(repo, "rev-parse", `${fix}^1`);
  } catch {
    out("The fix is the first commit; there is no “before the fix”.");
    return 2;
  }
  const code = fs.readFileSync(path.resolve(a.test), "utf8");
  const testPath = path.relative(repo, path.resolve(a.test)).startsWith("..") ? `tests/aftershock/${path.basename(a.test)}` : path.relative(repo, path.resolve(a.test));
  const { framework, install } = detect(repo, a.framework, a.install);
  const runner = new DockerRunner();
  out(`Time travelling ${testPath} · ${framework} · ${a.runs} runs per commit`);
  const spec = { repoUrl: repo, framework, install, testPath, testCode: code, runs: a.runs, timeoutMs: 120_000 };
  const before = await runner.run({ ...spec, sha: parent });
  out(`  before the fix ${parent.slice(0, 7)}: ${fmt(before.results)}`);
  const fixRun = before.results.every((r) => r.outcome === "failed") ? await runner.run({ ...spec, sha: fix }) : null;
  if (fixRun) out(`  on the fix     ${fix.slice(0, 7)}: ${fmt(fixRun.results)}`);
  const d = decideAdmission(before.results, fixRun?.results ?? [], a.runs);
  out(`\n${d.status.toUpperCase()}: ${d.reason}`);
  return exitCodeForProve(d.status);
}

function runInPlace(repo: string, framework: Framework, testPath: string, runs: number): RunResult[] {
  const results: RunResult[] = [];
  for (let i = 0; i < runs; i++) {
    const junit = path.join(repo, ".aftershock-out", `junit-${i}.xml`);
    fs.mkdirSync(path.dirname(junit), { recursive: true });
    fs.rmSync(junit, { force: true });
    const t0 = Date.now();
    const cmd = framework === "pytest" ? commandFor(framework, testPath, junit).replace(". .venv/bin/activate && ", "") : commandFor(framework, testPath, junit);
    const r = spawnSync("sh", ["-c", cmd], { cwd: repo, timeout: 120_000, stdio: "ignore" });
    results.push(r.error ? { outcome: "error", durationMs: Date.now() - t0, message: "Test exceeded the time limit" } : parseJUnit(fs.existsSync(junit) ? fs.readFileSync(junit, "utf8") : "", Date.now() - t0));
  }
  return results;
}

async function check(a: Extract<ReturnType<typeof parseArgs>, { command: "check" }>) {
  const repo = path.resolve(a.repo);
  const head = git(repo, "rev-parse", `${a.head}^{commit}`);
  const files = git(repo, "ls-tree", "-r", "--name-only", head, "--", a.tests).split("\n").filter((f) => /(^|\/)(test_[^/]+\.py|[^/]+\.(test|spec)\.[cm]?[jt]sx?)$/.test(f));
  const { framework, install } = detect(repo, a.framework, a.install);
  out(`Checking ${files.length} memory test${files.length === 1 ? "" : "s"} at ${head.slice(0, 7)}${a.inPlace ? " in place" : " in Docker"}`);
  if (!a.inPlace && files.length) setupFor(framework, install);
  const results: { path: string; runs: RunResult[]; verdict: ReturnType<typeof prVerdict> }[] = [];
  for (const f of files) {
    const runs = a.inPlace ? runInPlace(repo, framework, f, a.runs) : (await new DockerRunner().run({ repoUrl: repo, sha: head, framework, install, testPath: f, testCode: git(repo, "show", `${head}:${f}`), runs: a.runs, timeoutMs: 120_000 })).results;
    const verdict = prVerdict(runs);
    results.push({ path: f, runs, verdict });
    out(`  ${verdict.toUpperCase().padEnd(12)} ${f}  (${fmt(runs)})`);
  }
  if (a.report) {
    const url = process.env.AFTERSHOCK_URL;
    const token = process.env.AFTERSHOCK_TOKEN;
    if (!url || !token) throw new Error("--report needs AFTERSHOCK_URL and AFTERSHOCK_TOKEN");
    const remote = git(repo, "config", "--get", "remote.origin.url");
    const res = await fetch(`${url.replace(/\/$/, "")}/api/v1/checks/report`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ repository: remote.replace(/^.*github\.com[:/]/, "").replace(/\.git$/, ""), pr: a.pr, head, results: results.map(({ path: p, runs }) => ({ path: p, runs })) }),
    });
    if (!res.ok) throw new Error(`Reporting failed (${res.status}): ${await res.text()}`);
    out("Reported to Aftershock.");
  }
  return exitCodeForCheck(results.map((r) => r.verdict));
}

async function verify(a: Extract<ReturnType<typeof parseArgs>, { command: "verify" }>) {
  const url = process.env.AFTERSHOCK_URL;
  const token = process.env.AFTERSHOCK_TOKEN;
  if (!url || !token) throw new Error("verify needs AFTERSHOCK_URL and AFTERSHOCK_TOKEN. For a local run use: aftershock prove --fix <sha> --test <file>");
  const res = await fetch(`${url.replace(/\/$/, "")}/api/v1/incidents/${a.incident}/verify`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
  const body = (await res.json()) as { status?: string; url?: string; error?: string };
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  out(`Time travel started for incident ${a.incident}. Follow it at ${body.url}`);
  return 0;
}

async function main() {
  try {
    const a = parseArgs(process.argv.slice(2));
    const code = a.command === "prove" ? await prove(a) : a.command === "check" ? await check(a) : await verify(a);
    process.exit(code);
  } catch (err) {
    process.stderr.write(`aftershock: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(2);
  }
}

void main();
