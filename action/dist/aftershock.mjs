#!/usr/bin/env node

// cli/aftershock.ts
import { execFileSync, spawnSync } from "node:child_process";
import fs2 from "node:fs";
import path3 from "node:path";

// lib/domain/verdict.ts
function prVerdict(runs) {
  if (runs.length === 0) return "skipped";
  if (runs.some((r) => r.outcome === "error")) return "inconclusive";
  if (runs.every((r) => r.outcome === "failed")) return "recur";
  if (runs.every((r) => r.outcome === "passed")) return "safe";
  return "inconclusive";
}
function aggregatePr(verdicts) {
  if (verdicts.includes("recur")) return "recur";
  if (verdicts.includes("inconclusive")) return "inconclusive";
  if (verdicts.includes("safe")) return "safe";
  return "skipped";
}

// lib/runner/frameworks.ts
var q = (s) => `'${s.replace(/'/g, `'\\''`)}'`;
var FRAMEWORK_IDS = ["pytest", "vitest", "jest", "go", "junit", "rspec", "playwright"];
var under = (path4, testDir) => {
  const dir = testDir.replace(/\/$/, "");
  return path4.startsWith(dir + "/") ? null : `The draft must live under ${dir}/`;
};
var pythonVenv = "(command -v uv >/dev/null 2>&1 && uv venv --seed -q .venv || python -m venv .venv)";
var pytest = {
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
  checkDraftPath: (p, dir) => under(p, dir) ?? (/^(test_\w+|\w+_test)\.py$/.test(p.split("/").pop()) ? null : "pytest drafts must be test_*.py files"),
  draftHint: (dir) => `${dir}/test_<name>.py`,
  missingCode: /collection failure|ImportError|ModuleNotFoundError|NameError|has no attribute/i,
  defaultTestDir: "tests/aftershock",
  lockfiles: ["requirements.txt", "requirements-dev.txt", "pyproject.toml", "poetry.lock", "uv.lock", "Pipfile.lock", "setup.py", "setup.cfg"]
};
var js = (id) => ({
  id,
  label: id,
  language: "TypeScript",
  dockerImage: "node:22-slim",
  sandboxImage: "vercel/sandbox/node:22",
  setup: (install) => id === "jest" ? `${install} && npm install --no-save --no-audit --no-fund jest-junit` : install,
  command: (t, j) => id === "vitest" ? `npx vitest run ${q(t)} --reporter=junit --outputFile=${q(j)}` : `JEST_JUNIT_OUTPUT_FILE=${q(j)} npx jest ${q(t)} --ci --reporters=default --reporters=jest-junit`,
  inPlaceCommand: (t, j) => id === "vitest" ? `npx vitest run ${q(t)} --reporter=junit --outputFile=${q(j)}` : `JEST_JUNIT_OUTPUT_FILE=${q(j)} npx jest ${q(t)} --ci --reporters=default --reporters=jest-junit`,
  isTestFile: (p) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(p),
  isSetupFile: (p) => /(vitest|jest)\.config\.[cm]?[jt]s$/.test(p) || /(^|\/)setup(Tests)?\.[jt]s$/.test(p),
  definesTest: (code) => /\b(test|it)(\.each\([^)]*\))?\s*\(/.test(code),
  testName: (code) => code.match(/\b(?:test|it)\(\s*["'`]([^"'`]+)/)?.[1],
  checkDraftPath: (p, dir) => under(p, dir) ?? (/\.(test|spec)\.[cm]?[jt]sx?$/.test(p) ? null : `${id} drafts must be *.test.ts or *.test.js files`),
  draftHint: (dir) => `${dir}/<name>.test.ts`,
  missingCode: /failed to load|Cannot find module|is not a function|is not exported|does not provide an export|is not defined/i,
  defaultTestDir: "tests/aftershock",
  lockfiles: ["package.json", "package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lockb", ".npmrc"]
});
var GO_ENV = 'export GOPATH="$PWD/.aftershock-go" GOMODCACHE="$PWD/.aftershock-go/mod" GOCACHE="$PWD/.aftershock-go/cache" GOBIN="$PWD/.aftershock-go/bin" GOTOOLCHAIN=local GOFLAGS=-modcacherw';
var goPkg = (testPath) => `./${testPath.includes("/") ? testPath.slice(0, testPath.lastIndexOf("/")) : "."}`;
var goTest = (t, j) => `"$GOBIN/gotestsum" --junitfile ${q(j)} --format standard-quiet -- -count=1 -run '^TestAftershock' ${q(goPkg(t))}`;
var go = {
  id: "go",
  label: "go test",
  language: "Go",
  dockerImage: "golang:1.26",
  sandboxImage: "vercel/sandbox/universal",
  flag: "langGo",
  defaultTestDir: "",
  setup: (install) => `${GO_ENV} && (command -v go >/dev/null 2>&1 || (sudo apt-get update -qq >/dev/null && sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq golang-go >/dev/null)) && ${install} && go install gotest.tools/gotestsum@v1.13.0 && go test -count=1 -run '^$' ./... >/dev/null`,
  command: (t, j) => `${GO_ENV} GOFLAGS="-mod=mod -modcacherw" GOPROXY=off && ${goTest(t, j)}`,
  inPlaceCommand: (t, j) => `export GOBIN="$(go env GOPATH)/bin" && ([ -x "$GOBIN/gotestsum" ] || go install gotest.tools/gotestsum@v1.13.0) && ${goTest(t, j)}`,
  isTestFile: (p) => /_test\.go$/.test(p),
  isSetupFile: (p) => /(^|\/)go\.mod$/.test(p),
  definesTest: (code) => /func\s+TestAftershock\w*\s*\(\s*\w+\s+\*testing\.T\s*\)/.test(code),
  testName: (code) => code.match(/func\s+(TestAftershock\w*)/)?.[1],
  checkDraftPath: (p) => /(^|\/)aftershock_\w+_test\.go$/.test(p) ? null : "Go drafts must be aftershock_<name>_test.go files next to the package they test",
  draftHint: () => "<the package directory of the changed file>/aftershock_<name>_test.go, in the same package, with a test function named TestAftershock<Name>(t *testing.T)",
  missingCode: /undefined: |no required module provides package|cannot find package|build failed|setup failed/i,
  lockfiles: ["go.mod", "go.sum"]
};
var JAVA_INSTALL = "command -v java >/dev/null 2>&1 || (sudo apt-get update -qq >/dev/null && sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq openjdk-21-jdk-headless maven >/dev/null)";
var M2 = "-B -q -Dmaven.repo.local=.aftershock-m2";
var GRADLE = "--no-daemon -q -g .aftershock-gradle";
var MAVEN_WARMUP = [
  "mkdir -p src/test/java/aftershockwarmup",
  `printf 'package aftershockwarmup;\\nclass AftershockWarmupTest { @org.junit.jupiter.api.Test void ok() {} }\\n' > src/test/java/aftershockwarmup/AftershockWarmupTest.java`,
  `(mvn ${M2} -Dtest=AftershockWarmupTest -Dsurefire.failIfNoSpecifiedTests=false test; s=$?; rm -rf src/test/java/aftershockwarmup target/surefire-reports; exit $s)`
].join(" && ");
var javaClass = (testPath) => testPath.split("/").pop().replace(/\.(java|kt)$/, "");
var junitRun = (t, j, offline) => {
  const cls = q(javaClass(t));
  const maven = `mvn ${offline ? "-o " : ""}${M2} -Dtest=${cls} -Dsurefire.failIfNoSpecifiedTests=false test`;
  const gradle = `./gradlew ${offline ? "--offline " : ""}${GRADLE} test --tests ${q(`*.${javaClass(t)}`)}`;
  const log = ".aftershock-out/build.log";
  return [
    "rm -rf target/surefire-reports build/test-results/test",
    `(if [ -f pom.xml ]; then ${maven}; else chmod +x gradlew && ${gradle}; fi) > ${log} 2>&1`,
    `if [ -n "$(ls target/surefire-reports/TEST-*.xml build/test-results/test/TEST-*.xml 2>/dev/null)" ]; then cat target/surefire-reports/TEST-*.xml build/test-results/test/TEST-*.xml 2>/dev/null > ${q(j)}; else printf '<testsuite errors="1"><testcase name="build"><error message="%s"/></testcase></testsuite>' "$( (grep -m1 -E 'cannot find symbol|does not exist|Unresolved reference' ${log} || grep -m1 -E 'error:|ERROR' ${log}) | sed 's/[<>&"]/ /g' | cut -c1-300)" > ${q(j)}; fi`,
    `tail -n 60 ${log}`
  ].join("; ");
};
var junit = {
  id: "junit",
  label: "JUnit (Maven or Gradle)",
  language: "Java",
  dockerImage: "maven:3.9-eclipse-temurin-21",
  sandboxImage: "vercel/sandbox/universal",
  flag: "langJunit",
  defaultTestDir: "src/test/java/aftershock",
  setup: (install) => `${JAVA_INSTALL} && ${install} && mkdir -p .aftershock-out && (if [ -f pom.xml ]; then ${MAVEN_WARMUP}; else chmod +x gradlew && ./gradlew ${GRADLE} testClasses; fi)`,
  command: (t, j) => junitRun(t, j, true),
  inPlaceCommand: (t, j) => junitRun(t, j, false),
  isTestFile: (p) => /src\/test\/(java|kotlin)\/.+Test\.(java|kt)$/.test(p),
  isSetupFile: (p) => /(^|\/)(pom\.xml|build\.gradle(\.kts)?)$/.test(p),
  definesTest: (code) => /@Test\b/.test(code),
  testName: (code) => code.match(/class\s+(\w+)/)?.[1],
  checkDraftPath: (p) => /(^|\/)src\/test\/(java|kotlin)\/(.+\/)?Aftershock\w*Test\.(java|kt)$/.test(p) ? null : "Java and Kotlin drafts must be src/test/java/<package>/Aftershock<Name>Test.java (or .kt under src/test/kotlin)",
  draftHint: () => "src/test/java/<the package of the changed class, as folders>/Aftershock<Name>Test.java (Kotlin: src/test/kotlin/\u2026/Aftershock<Name>Test.kt), in the same package, using JUnit 5 @Test",
  missingCode: /cannot find symbol|package \S+ does not exist|Unresolved reference|NoSuchMethodError|NoClassDefFoundError/i,
  lockfiles: ["pom.xml", "build.gradle", "build.gradle.kts", "settings.gradle", "settings.gradle.kts", "gradle/libs.versions.toml", "gradle/wrapper/gradle-wrapper.properties"]
};
var RSPEC_TO_JUNIT = `require "json"
require "cgi"
x = ->(s) { CGI.escapeHTML(s.to_s)[0, 500] }
d = (JSON.parse(File.read(ARGV[0])) rescue nil)
if d.nil? || d["examples"].to_a.empty?
  why = d ? d["messages"].to_a.join(" ") : (File.read(ARGV[1]) rescue "rspec did not run")
  why = why[/(uninitialized constant[^\\n]*|cannot load such file[^\\n]*|undefined method[^\\n]*|[A-Z]\\w*Error[^\\n]*)/] || why
  puts %(<testsuite errors="1"><testcase name="load"><error message="#{x.(why)}"/></testcase></testsuite>)
else
  cases = d["examples"].map do |e|
    body = case e["status"]
           when "failed" then %(<failure message="#{x.(e.dig("exception", "message"))}"/>)
           when "pending" then "<skipped/>"
           else ""
           end
    %(<testcase name="#{x.(e["full_description"])}">#{body}</testcase>)
  end
  puts "<testsuite>#{cases.join}</testsuite>"
end
`;
var RUBY_INSTALL = "command -v ruby >/dev/null 2>&1 || (sudo apt-get update -qq >/dev/null && sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq ruby-full >/dev/null)";
var BUNDLE_ENV = 'export BUNDLE_PATH="$PWD/.aftershock-bundle" BUNDLE_DISABLE_SHARED_GEMS=true';
var rspecRun = (t, j) => `${BUNDLE_ENV} && (bundle exec rspec ${q(t)} --format json --out .aftershock-out/rspec.json > .aftershock-out/rspec.log 2>&1; true) && ruby .aftershock-out/rspec_junit.rb .aftershock-out/rspec.json .aftershock-out/rspec.log > ${q(j)}; tail -n 40 .aftershock-out/rspec.log`;
var rspec = {
  id: "rspec",
  label: "RSpec",
  language: "Ruby",
  dockerImage: "ruby:3.3",
  sandboxImage: "vercel/sandbox/universal",
  flag: "langRspec",
  defaultTestDir: "spec/aftershock",
  supportFiles: [{ path: ".aftershock-out/rspec_junit.rb", content: RSPEC_TO_JUNIT }],
  setup: (install) => `${RUBY_INSTALL} && ${BUNDLE_ENV} && ${install}`,
  command: rspecRun,
  inPlaceCommand: rspecRun,
  isTestFile: (p) => /_spec\.rb$/.test(p),
  isSetupFile: (p) => /(^|\/)(spec_helper|rails_helper)\.rb$|(^|\/)\.rspec$/.test(p),
  definesTest: (code) => /\b(it|specify|example)\s*\(?\s*["']/.test(code),
  testName: (code) => code.match(/\bit\s*\(?\s*["']([^"']+)/)?.[1],
  checkDraftPath: (p, dir) => under(p, dir) ?? (/_spec\.rb$/.test(p) ? null : "RSpec drafts must be *_spec.rb files"),
  draftHint: (dir) => `${dir}/<name>_spec.rb`,
  missingCode: /uninitialized constant|cannot load such file|undefined method|NameError|LoadError/i,
  lockfiles: ["Gemfile", "Gemfile.lock", ".ruby-version"]
};
var PW_ENV = 'export PLAYWRIGHT_BROWSERS_PATH="$PWD/.aftershock-pw"';
var playwrightRun = (t, j) => `${PW_ENV} && PLAYWRIGHT_JUNIT_OUTPUT_NAME=${q(j)} npx playwright test ${q(t)} --reporter=junit,line --workers=1`;
var playwright = {
  id: "playwright",
  label: "Playwright",
  language: "TypeScript",
  dockerImage: "mcr.microsoft.com/playwright:v1.55.0-noble",
  sandboxImage: "vercel/sandbox/universal",
  flag: "langPlaywright",
  defaultTestDir: "e2e/aftershock",
  // Browsers download during install, while the network is open; system libraries need sudo on the sandbox image.
  setup: (install) => `${install} && ${PW_ENV} && (npx playwright install --with-deps chromium >/dev/null 2>&1 || npx playwright install chromium)`,
  command: playwrightRun,
  inPlaceCommand: playwrightRun,
  isTestFile: (p) => /\.(spec|test)\.[cm]?[jt]sx?$/.test(p),
  isSetupFile: (p) => /playwright\.config\.[cm]?[jt]s$/.test(p) || /(^|\/)(global-setup|fixtures)\.[jt]s$/.test(p),
  definesTest: (code) => /\btest(\.(only|describe|step))?\s*\(/.test(code),
  testName: (code) => code.match(/\btest\(\s*["'`]([^"'`]+)/)?.[1],
  checkDraftPath: (p, dir) => under(p, dir) ?? (/\.spec\.[jt]s$/.test(p) ? null : "Playwright drafts must be *.spec.ts files"),
  draftHint: (dir) => `${dir}/<name>.spec.ts (import { test, expect } from "@playwright/test"; use page and baseURL)`,
  missingCode: /Cannot find module|is not a function|is not exported/i,
  lockfiles: ["package.json", "package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lockb", ".npmrc", "playwright.config.ts", "playwright.config.js"]
};
var DEFS = { pytest, vitest: js("vitest"), jest: js("jest"), go, junit, rspec, playwright };
function frameworkDef(id) {
  return DEFS[id];
}
function isFramework(x) {
  return typeof x === "string" && FRAMEWORK_IDS.includes(x);
}
var MISSING_CODE = new RegExp(Object.values(DEFS).map((d) => d.missingCode.source).join("|"), "i");
async function detectFramework(read) {
  const pkg = await read("package.json");
  if (pkg) {
    let deps = {};
    try {
      const json = JSON.parse(pkg);
      deps = { ...json.dependencies, ...json.devDependencies };
    } catch {
    }
    const lock = await read("package-lock.json") !== null;
    const install = lock ? "npm ci" : "npm install";
    if (deps["@playwright/test"] && !deps.vitest && !deps.jest) {
      const cfg = await read("playwright.config.ts") ?? await read("playwright.config.js") ?? "";
      const dir = cfg.match(/testDir\s*:\s*["'`]\.?\/?([^"'`]*?)\/?["'`]/)?.[1];
      return { framework: "playwright", install, language: "TypeScript", testDir: dir ? `${dir}/aftershock` : "e2e/aftershock" };
    }
    return { framework: deps.vitest ? "vitest" : "jest", install, language: "TypeScript" };
  }
  if (await read("pom.xml") !== null || await read("build.gradle") !== null || await read("build.gradle.kts") !== null) return { framework: "junit", install: "true", language: "Java" };
  if (await read("Gemfile") !== null) return { framework: "rspec", install: "bundle install", language: "Ruby" };
  if (await read("go.mod") !== null) return { framework: "go", install: "go mod download", language: "Go" };
  if (await read("requirements.txt") !== null) return { framework: "pytest", install: "pip install -r requirements.txt", language: "Python" };
  if (await read("pyproject.toml") !== null) return { framework: "pytest", install: "pip install -e .", language: "Python" };
  return { framework: "pytest", install: "true", language: "Python" };
}

// cli/args.ts
var FLAGS = {
  prove: ["--fix", "--test", "--repo", "--framework", "--install", "--runs"],
  check: ["--head", "--repo", "--tests", "--framework", "--install", "--runs", "--in-place", "--pr", "--report"],
  verify: []
};
var BOOL = /* @__PURE__ */ new Set(["--in-place", "--report"]);
function parseArgs(argv) {
  const [command, ...rest] = argv;
  if (!command || !(command in FLAGS)) throw new Error(`Unknown command: ${command ?? "(none)"}. Use prove, check or verify.`);
  const flags = {};
  const positional = [];
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (!a.startsWith("--")) {
      positional.push(a);
      continue;
    }
    if (!FLAGS[command].includes(a)) throw new Error(`Unknown option for ${command}: ${a}`);
    if (BOOL.has(a)) flags[a] = true;
    else {
      const v = rest[++i];
      if (v === void 0 || v.startsWith("--")) throw new Error(`${a} needs a value`);
      flags[a] = v;
    }
  }
  const str = (k) => typeof flags[k] === "string" ? flags[k] : void 0;
  const runs = Number(str("--runs") ?? 3);
  if (!Number.isInteger(runs) || runs < 1 || runs > 10) throw new Error("--runs must be between 1 and 10");
  const framework = str("--framework");
  if (framework && !isFramework(framework)) throw new Error(`--framework must be one of: ${FRAMEWORK_IDS.join(", ")}`);
  if (command === "verify") {
    const m = positional[0]?.match(/^[A-Za-z]+-(\d+)$|^(\d+)$/);
    if (!m) throw new Error("verify needs an incident like INC-12");
    return { command: "verify", incident: Number(m[1] ?? m[2]) };
  }
  if (command === "prove") {
    if (!str("--fix")) throw new Error("prove needs --fix <commit>");
    if (!str("--test")) throw new Error("prove needs --test <path to the test file>");
    return { command: "prove", fix: str("--fix"), test: str("--test"), repo: str("--repo") ?? ".", framework, install: str("--install"), runs };
  }
  const pr = str("--pr") ? Number(str("--pr")) : void 0;
  if (pr !== void 0 && !Number.isInteger(pr)) throw new Error("--pr must be a number");
  return { command: "check", head: str("--head") ?? "HEAD", repo: str("--repo") ?? ".", tests: str("--tests") ?? "tests/aftershock", framework, install: str("--install"), runs, inPlace: flags["--in-place"] === true, pr, report: flags["--report"] === true };
}
function exitCodeForCheck(verdicts) {
  const v = aggregatePr(verdicts);
  return v === "recur" ? 1 : v === "inconclusive" ? 2 : 0;
}
function exitCodeForProve(status) {
  return status === "proven" ? 0 : 2;
}

// lib/runner/docker.ts
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path2 from "node:path";

// lib/runner/adapters.ts
function imageFor(f) {
  return frameworkDef(f).dockerImage;
}
function setupFor(f, install) {
  return frameworkDef(f).setup(install);
}
function commandFor(f, testPath, junitPath) {
  return frameworkDef(f).command(testPath, junitPath);
}

// lib/runner/junit.ts
var unescape = (s) => s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d))).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
function attr(tag, name) {
  const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`));
  return m ? unescape(m[1]) : void 0;
}
function parseJUnit(xml, durationMs) {
  const cases = xml.match(/<testcase\b[\s\S]*?(?:\/>|<\/testcase>)/g) ?? [];
  if (cases.length === 0) {
    const suiteErr = xml.match(/<testsuite\b[^>]*\serrors="([1-9]\d*)"/);
    return { outcome: "error", durationMs, message: suiteErr ? "The test file failed to load" : "No test ran" };
  }
  for (const c of cases) {
    const err = c.match(/<error\b[^>]*>/);
    if (err) return { outcome: "error", durationMs, message: attr(err[0], "message") ?? "Test errored before running" };
    if (/<skipped\b/.test(c)) return { outcome: "error", durationMs, message: "The test was skipped" };
  }
  for (const c of cases) {
    const f = c.match(/<failure\b[^>]*>/);
    if (f) {
      const body = c.match(/<failure\b[^>]*>([\s\S]*?)<\/failure>/)?.[1];
      return { outcome: "failed", durationMs, message: attr(f[0], "message") ?? unescape(body ?? "").trim().split("\n").at(-1) ?? "failed" };
    }
  }
  return { outcome: "passed", durationMs };
}

// lib/runner/paths.ts
import path from "node:path";
function safeTestPath(p) {
  const norm = path.posix.normalize(p.replace(/\\/g, "/"));
  if (!norm || norm.startsWith("/") || norm.startsWith("..") || norm.split("/").includes("..") || norm.startsWith(".git/") || norm === ".git") {
    throw new Error(`Unsafe test path: ${p}`);
  }
  return norm;
}

// lib/runner/secrets.ts
function redactToken(text, token) {
  if (!token || token.length < 8) return text;
  return text.split(token).join("[redacted]");
}

// lib/runner/docker.ts
var TAIL = 16e3;
function exec(cmd, args, opts) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(cmd, args, { cwd: opts.cwd, stdio: ["pipe", "pipe", "pipe"] });
    let out2 = "";
    const take = (b) => {
      out2 = (out2 + b.toString("utf8")).slice(-TAIL);
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
      resolve({ code, out: out2, timedOut, ms: Date.now() - started });
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ code: -1, out: String(err), timedOut, ms: Date.now() - started });
    });
    if (opts.input) child.stdin.end(opts.input);
    else child.stdin.end();
  });
}
function removeTree(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    const walk = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path2.join(d, e.name);
        try {
          fs.chmodSync(p, 448);
        } catch {
        }
        if (e.isDirectory() && !e.isSymbolicLink()) walk(p);
      }
    };
    fs.chmodSync(dir, 448);
    walk(dir);
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
var isLocal = (url) => url.startsWith("/") || url.startsWith("file://");
async function exportCommit(repoUrl, sha, token, dest) {
  if (!/^[0-9a-f]{7,40}$/i.test(sha) && !/^[A-Za-z0-9._/-]{1,100}$/.test(sha)) throw new Error("Invalid commit reference");
  let gitDir;
  if (isLocal(repoUrl)) {
    gitDir = repoUrl.replace(/^file:\/\//, "");
  } else {
    const cache = path2.join(os.homedir(), ".cache", "aftershock", "repos", createHash("sha1").update(repoUrl).digest("hex"));
    const auth = token ? ["-c", `http.extraHeader=Authorization: Basic ${Buffer.from(`x-access-token:${token}`).toString("base64")}`] : [];
    if (!fs.existsSync(cache)) {
      fs.mkdirSync(path2.dirname(cache), { recursive: true });
      const c = await exec("git", [...auth, "clone", "--quiet", "--bare", "--filter=blob:none", repoUrl, cache], { timeoutMs: 3e5 });
      if (c.code !== 0) throw new Error("Could not clone the repository");
    }
    const f = await exec("git", [...auth, "-C", cache, "fetch", "--quiet", "origin", sha], { timeoutMs: 3e5 });
    if (f.code !== 0) {
      const has = await exec("git", ["-C", cache, "cat-file", "-e", `${sha}^{commit}`], { timeoutMs: 3e4 });
      if (has.code !== 0) throw new Error(`Commit ${sha} could not be fetched`);
    }
    gitDir = cache;
  }
  const archive = path2.join(dest, "..", `${path2.basename(dest)}.tar`);
  const a = await exec("git", ["-C", gitDir, "archive", "--format=tar", "-o", archive, sha], { timeoutMs: 12e4 });
  if (a.code !== 0) throw new Error(`Commit ${sha} does not exist in the repository`);
  fs.mkdirSync(dest, { recursive: true });
  const x = await exec("tar", ["-xf", archive, "-C", dest], { timeoutMs: 12e4 });
  fs.rmSync(archive, { force: true });
  if (x.code !== 0) throw new Error("Could not unpack the commit");
}
var DockerRunner = class {
  kind = "docker";
  async run(spec) {
    const testPath = safeTestPath(spec.testPath);
    const started = Date.now();
    const root = process.env.AFTERSHOCK_WORK_DIR ?? path2.join(os.homedir(), ".cache", "aftershock", "runs");
    fs.mkdirSync(root, { recursive: true });
    const base = fs.realpathSync(fs.mkdtempSync(path2.join(root, "run-")));
    const work = path2.join(base, "w");
    const logs = [];
    try {
      await exportCommit(spec.repoUrl, spec.sha, spec.token, work);
      fs.mkdirSync(path2.join(work, ".aftershock-out"), { recursive: true });
      const image = imageFor(spec.framework);
      const user = process.platform === "linux" && typeof process.getuid === "function" ? ["--user", `${process.getuid()}:${process.getgid()}`] : [];
      const workdir = spec.workdir ? safeTestPath(spec.workdir) : "";
      const pkg = workdir ? path2.join(work, workdir) : work;
      const relTest = workdir ? path2.posix.relative(workdir, testPath) : testPath;
      fs.mkdirSync(path2.join(pkg, ".aftershock-out"), { recursive: true });
      const common = ["run", "--rm", ...user, "-e", "HOME=/tmp", "-e", "CI=1", "-v", `${work}:/w`, "-w", workdir ? `/w/${workdir}` : "/w", "--memory", "2g", "--cpus", "2"];
      const install = await exec("docker", [...common, image, "sh", "-c", setupFor(spec.framework, spec.install)], { timeoutMs: 15 * 6e4 });
      logs.push(`$ ${spec.install}
${install.out.slice(-4e3)}`);
      if (install.code !== 0) {
        const message = install.timedOut ? "Dependency install timed out" : `Dependency install failed (exit ${install.code})`;
        return { installOk: false, results: Array.from({ length: spec.runs }, () => ({ outcome: "error", durationMs: 0, message })), log: redactToken(logs.join("\n\n"), spec.token), cpuMs: 0, wallMs: Date.now() - started };
      }
      const target = path2.join(work, testPath);
      fs.mkdirSync(path2.dirname(target), { recursive: true });
      fs.writeFileSync(target, spec.testCode);
      const files = [...(spec.overlay ?? []).map((o) => ({ ...o, base: work })), ...(frameworkDef(spec.framework).supportFiles ?? []).map((o) => ({ ...o, base: pkg }))];
      for (const o of files) {
        const file = path2.join(o.base, safeTestPath(o.path));
        fs.mkdirSync(path2.dirname(file), { recursive: true });
        fs.writeFileSync(file, o.content);
      }
      const results = [];
      let testMs = 0;
      for (let i = 0; i < spec.runs; i++) {
        const junit2 = `.aftershock-out/junit-${i}.xml`;
        const name = `aftershock-${randomUUID().slice(0, 12)}`;
        const r = await exec("docker", [...common, "--name", name, "--network", "none", image, "sh", "-c", commandFor(spec.framework, relTest, workdir ? `/w/${workdir}/${junit2}` : `/w/${junit2}`)], {
          timeoutMs: spec.timeoutMs,
          onTimeout: () => void exec("docker", ["rm", "-f", name], { timeoutMs: 3e4 })
        });
        testMs += r.ms;
        if (i === 0 || r.code !== 0) logs.push(`$ run ${i + 1}
${r.out.slice(-3e3)}`);
        if (r.timedOut) {
          results.push({ outcome: "error", durationMs: r.ms, message: `Test exceeded the ${Math.round(spec.timeoutMs / 1e3)}s time limit` });
          continue;
        }
        const file = path2.join(pkg, junit2);
        results.push(parseJUnit(fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "", r.ms));
      }
      return { installOk: true, results, log: redactToken(logs.join("\n\n"), spec.token), cpuMs: testMs, wallMs: Date.now() - started };
    } finally {
      removeTree(base);
    }
  }
};

// lib/domain/admission.ts
var count = (runs, outcome) => runs.filter((r) => r.outcome === outcome).length;
function decideAdmission(before, fix, runsRequired = 3) {
  if (before.length < runsRequired || fix.length < runsRequired) {
    return { status: "unproven", reason: `Needed ${runsRequired} runs on each commit; got ${before.length} before and ${fix.length} on the fix.` };
  }
  if (count(before, "error") || count(fix, "error")) {
    const failing = before.concat(fix).find((r) => r.outcome === "error");
    return {
      status: "unproven",
      reason: `The environment failed, so nothing was proven${failing?.message ? `: ${failing.message}` : "."}`
    };
  }
  if (count(before, "passed") === before.length) {
    return {
      status: "rejected",
      reason: "The draft passed before the fix, so it does not reproduce the incident.",
      feedback: "The previous draft passed before the fix. It must exercise the exact failure described in the incident so it fails on the parent commit."
    };
  }
  if (count(before, "failed") !== before.length) {
    return {
      status: "unproven",
      reason: `Flaky before the fix: failed ${count(before, "failed")} of ${before.length} runs.`,
      feedback: "The previous draft failed only some of the time before the fix. Remove timing or ordering dependence."
    };
  }
  if (count(fix, "passed") !== fix.length) {
    return {
      status: "unproven",
      reason: `Did not pass on the fix: passed ${count(fix, "passed")} of ${fix.length} runs.`,
      feedback: "The previous draft also failed on the fix commit. It must pass once the fix is applied; assert only the behaviour the fix guarantees."
    };
  }
  return { status: "proven", reason: `Failed ${before.length}/${before.length} before the fix and passed ${fix.length}/${fix.length} on it.` };
}

// cli/aftershock.ts
var out = (s) => process.stdout.write(s + "\n");
var git = (repo, ...a) => execFileSync("git", ["-C", repo, ...a], { encoding: "utf8" }).trim();
async function detect(repo, framework, install) {
  const read = async (f) => fs2.existsSync(path3.join(repo, f)) ? fs2.readFileSync(path3.join(repo, f), "utf8") : null;
  const found = await detectFramework(read);
  if (framework) return { framework, install: install ?? (framework === found.framework ? found.install : framework === "pytest" ? "pip install -r requirements.txt" : "npm ci") };
  return { framework: found.framework, install: install ?? found.install };
}
var fmt = (rs) => rs.map((r) => r.outcome === "passed" ? "pass" : r.outcome === "failed" ? "FAIL" : "error").join(" ");
async function prove(a) {
  const repo = path3.resolve(a.repo);
  const fix = git(repo, "rev-parse", `${a.fix}^{commit}`);
  let parent;
  try {
    parent = git(repo, "rev-parse", `${fix}^1`);
  } catch {
    out("The fix is the first commit; there is no \u201Cbefore the fix\u201D.");
    return 2;
  }
  const code = fs2.readFileSync(path3.resolve(a.test), "utf8");
  const testPath = path3.relative(repo, path3.resolve(a.test)).startsWith("..") ? `tests/aftershock/${path3.basename(a.test)}` : path3.relative(repo, path3.resolve(a.test));
  const { framework, install } = await detect(repo, a.framework, a.install);
  const runner = new DockerRunner();
  out(`Time travelling ${testPath} \xB7 ${framework} \xB7 ${a.runs} runs per commit`);
  const spec = { repoUrl: repo, framework, install, testPath, testCode: code, runs: a.runs, timeoutMs: 12e4 };
  const before = await runner.run({ ...spec, sha: parent });
  out(`  before the fix ${parent.slice(0, 7)}: ${fmt(before.results)}`);
  const fixRun = before.results.every((r) => r.outcome === "failed") ? await runner.run({ ...spec, sha: fix }) : null;
  if (fixRun) out(`  on the fix     ${fix.slice(0, 7)}: ${fmt(fixRun.results)}`);
  const d = decideAdmission(before.results, fixRun?.results ?? [], a.runs);
  out(`
${d.status.toUpperCase()}: ${d.reason}`);
  return exitCodeForProve(d.status);
}
function runInPlace(repo, framework, testPath, runs) {
  const results = [];
  for (let i = 0; i < runs; i++) {
    const junit2 = path3.join(repo, ".aftershock-out", `junit-${i}.xml`);
    fs2.mkdirSync(path3.dirname(junit2), { recursive: true });
    fs2.rmSync(junit2, { force: true });
    const t0 = Date.now();
    const cmd = frameworkDef(framework).inPlaceCommand(testPath, junit2);
    const r = spawnSync("sh", ["-c", cmd], { cwd: repo, timeout: 12e4, stdio: "ignore" });
    results.push(r.error ? { outcome: "error", durationMs: Date.now() - t0, message: "Test exceeded the time limit" } : parseJUnit(fs2.existsSync(junit2) ? fs2.readFileSync(junit2, "utf8") : "", Date.now() - t0));
  }
  return results;
}
async function check(a) {
  const repo = path3.resolve(a.repo);
  const head = git(repo, "rev-parse", `${a.head}^{commit}`);
  const { framework, install } = await detect(repo, a.framework, a.install);
  const files = git(repo, "ls-tree", "-r", "--name-only", head, "--", a.tests).split("\n").filter((f) => f && frameworkDef(framework).isTestFile(f));
  out(`Checking ${files.length} memory test${files.length === 1 ? "" : "s"} at ${head.slice(0, 7)}${a.inPlace ? " in place" : " in Docker"}`);
  const results = [];
  for (const f of files) {
    const runs = a.inPlace ? runInPlace(repo, framework, f, a.runs) : (await new DockerRunner().run({ repoUrl: repo, sha: head, framework, install, testPath: f, testCode: git(repo, "show", `${head}:${f}`), runs: a.runs, timeoutMs: 12e4 })).results;
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
      body: JSON.stringify({ repository: remote.replace(/^.*github\.com[:/]/, "").replace(/\.git$/, ""), pr: a.pr, head, results: results.map(({ path: p, runs }) => ({ path: p, runs })) })
    });
    if (!res.ok) throw new Error(`Reporting failed (${res.status}): ${await res.text()}`);
    out("Reported to Aftershock.");
  }
  return exitCodeForCheck(results.map((r) => r.verdict));
}
async function verify(a) {
  const url = process.env.AFTERSHOCK_URL;
  const token = process.env.AFTERSHOCK_TOKEN;
  if (!url || !token) throw new Error("verify needs AFTERSHOCK_URL and AFTERSHOCK_TOKEN. For a local run use: aftershock prove --fix <sha> --test <file>");
  const res = await fetch(`${url.replace(/\/$/, "")}/api/v1/incidents/${a.incident}/verify`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
  const body = await res.json();
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
    process.stderr.write(`aftershock: ${err instanceof Error ? err.message : String(err)}
`);
    process.exit(2);
  }
}
void main();
