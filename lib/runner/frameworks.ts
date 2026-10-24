/**
 * Every test framework Aftershock can prove with, in one place: how to detect it, install it,
 * run one test file to a JUnit report, where drafts live, and how to read its errors.
 */

export const q = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

export const FRAMEWORK_IDS = ["pytest", "vitest", "jest", "go", "junit", "rspec"] as const;
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
  /** Files whose contents decide the installed dependencies (the install cache key). */
  lockfiles: string[];
  /** Labs flag a workspace needs before this framework is used. */
  flag?: "langGo" | "langJunit" | "langRspec" | "langPlaywright";
  /** Where drafts go when the repository does not configure test_dir. */
  defaultTestDir: string;
  /** Helper files Aftershock writes next to the draft (never into the repository's own files). */
  supportFiles?: { path: string; content: string }[];
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
  defaultTestDir: "tests/aftershock",
  lockfiles: ["requirements.txt", "requirements-dev.txt", "pyproject.toml", "poetry.lock", "uv.lock", "Pipfile.lock", "setup.py", "setup.cfg"],
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
  defaultTestDir: "tests/aftershock",
  lockfiles: ["package.json", "package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lockb", ".npmrc"],
});


// Go: tests live next to their package (same package name), and only TestAftershock* runs.
const GO_ENV = 'export GOPATH="$PWD/.aftershock-go" GOMODCACHE="$PWD/.aftershock-go/mod" GOCACHE="$PWD/.aftershock-go/cache" GOBIN="$PWD/.aftershock-go/bin" GOTOOLCHAIN=local GOFLAGS=-modcacherw';
const goPkg = (testPath: string) => `./${testPath.includes("/") ? testPath.slice(0, testPath.lastIndexOf("/")) : "."}`;
const goTest = (t: string, j: string) => `"$GOBIN/gotestsum" --junitfile ${q(j)} --format standard-quiet -- -count=1 -run '^TestAftershock' ${q(goPkg(t))}`;

const go: FrameworkDef = {
  id: "go",
  label: "go test",
  language: "Go",
  dockerImage: "golang:1.26",
  sandboxImage: "vercel/sandbox/universal",
  flag: "langGo",
  defaultTestDir: "",
  setup: (install) =>
    `${GO_ENV} && (command -v go >/dev/null 2>&1 || (sudo apt-get update -qq >/dev/null && sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq golang-go >/dev/null)) && ${install} && go install gotest.tools/gotestsum@v1.13.0 && go test -count=1 -run '^$' ./... >/dev/null`,
  command: (t, j) => `${GO_ENV} GOFLAGS="-mod=mod -modcacherw" GOPROXY=off && ${goTest(t, j)}`,
  inPlaceCommand: (t, j) => `export GOBIN="$(go env GOPATH)/bin" && ([ -x "$GOBIN/gotestsum" ] || go install gotest.tools/gotestsum@v1.13.0) && ${goTest(t, j)}`,
  isTestFile: (p) => /_test\.go$/.test(p),
  isSetupFile: (p) => /(^|\/)go\.mod$/.test(p),
  definesTest: (code) => /func\s+TestAftershock\w*\s*\(\s*\w+\s+\*testing\.T\s*\)/.test(code),
  testName: (code) => code.match(/func\s+(TestAftershock\w*)/)?.[1],
  checkDraftPath: (p) => (/(^|\/)aftershock_\w+_test\.go$/.test(p) ? null : "Go drafts must be aftershock_<name>_test.go files next to the package they test"),
  draftHint: () => "<the package directory of the changed file>/aftershock_<name>_test.go, in the same package, with a test function named TestAftershock<Name>(t *testing.T)",
  missingCode: /undefined: |no required module provides package|cannot find package|build failed|setup failed/i,
  lockfiles: ["go.mod", "go.sum"],
};

// Java and Kotlin: Maven or Gradle (wrapper), detected in the checkout. Build output is captured so a
// compile error (for example a method that does not exist yet) becomes a JUnit error with its message.
const JAVA_INSTALL = "command -v java >/dev/null 2>&1 || (sudo apt-get update -qq >/dev/null && sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq openjdk-21-jdk-headless maven >/dev/null)";
const M2 = "-B -q -Dmaven.repo.local=.aftershock-m2";
const GRADLE = "--no-daemon -q -g .aftershock-gradle";
// Surefire downloads its JUnit provider only when a test runs, so the install phase runs a throwaway one.
const MAVEN_WARMUP = [
  "mkdir -p src/test/java/aftershockwarmup",
  `printf 'package aftershockwarmup;\\nclass AftershockWarmupTest { @org.junit.jupiter.api.Test void ok() {} }\\n' > src/test/java/aftershockwarmup/AftershockWarmupTest.java`,
  `(mvn ${M2} -Dtest=AftershockWarmupTest -Dsurefire.failIfNoSpecifiedTests=false test; s=$?; rm -rf src/test/java/aftershockwarmup target/surefire-reports; exit $s)`,
].join(" && ");
const javaClass = (testPath: string) => testPath.split("/").pop()!.replace(/\.(java|kt)$/, "");
const junitRun = (t: string, j: string, offline: boolean) => {
  const cls = q(javaClass(t));
  const maven = `mvn ${offline ? "-o " : ""}${M2} -Dtest=${cls} -Dsurefire.failIfNoSpecifiedTests=false test`;
  const gradle = `./gradlew ${offline ? "--offline " : ""}${GRADLE} test --tests ${q(`*.${javaClass(t)}`)}`;
  const log = ".aftershock-out/build.log";
  return [
    "rm -rf target/surefire-reports build/test-results/test",
    `(if [ -f pom.xml ]; then ${maven}; else chmod +x gradlew && ${gradle}; fi) > ${log} 2>&1`,
    `if [ -n "$(ls target/surefire-reports/TEST-*.xml build/test-results/test/TEST-*.xml 2>/dev/null)" ]; then cat target/surefire-reports/TEST-*.xml build/test-results/test/TEST-*.xml 2>/dev/null > ${q(j)}; else printf '<testsuite errors="1"><testcase name="build"><error message="%s"/></testcase></testsuite>' "$( (grep -m1 -E 'cannot find symbol|does not exist|Unresolved reference' ${log} || grep -m1 -E 'error:|ERROR' ${log}) | sed 's/[<>&"]/ /g' | cut -c1-300)" > ${q(j)}; fi`,
    `tail -n 60 ${log}`,
  ].join("; ");
};

const junit: FrameworkDef = {
  id: "junit",
  label: "JUnit (Maven or Gradle)",
  language: "Java",
  dockerImage: "maven:3.9-eclipse-temurin-21",
  sandboxImage: "vercel/sandbox/universal",
  flag: "langJunit",
  defaultTestDir: "src/test/java/aftershock",
  setup: (install) =>
    `${JAVA_INSTALL} && ${install} && mkdir -p .aftershock-out && (if [ -f pom.xml ]; then ${MAVEN_WARMUP}; else chmod +x gradlew && ./gradlew ${GRADLE} testClasses; fi)`,
  command: (t, j) => junitRun(t, j, true),
  inPlaceCommand: (t, j) => junitRun(t, j, false),
  isTestFile: (p) => /src\/test\/(java|kotlin)\/.+Test\.(java|kt)$/.test(p),
  isSetupFile: (p) => /(^|\/)(pom\.xml|build\.gradle(\.kts)?)$/.test(p),
  definesTest: (code) => /@Test\b/.test(code),
  testName: (code) => code.match(/class\s+(\w+)/)?.[1],
  checkDraftPath: (p) => (/(^|\/)src\/test\/(java|kotlin)\/(.+\/)?Aftershock\w*Test\.(java|kt)$/.test(p) ? null : "Java and Kotlin drafts must be src/test/java/<package>/Aftershock<Name>Test.java (or .kt under src/test/kotlin)"),
  draftHint: () => "src/test/java/<the package of the changed class, as folders>/Aftershock<Name>Test.java (Kotlin: src/test/kotlin/…/Aftershock<Name>Test.kt), in the same package, using JUnit 5 @Test",
  missingCode: /cannot find symbol|package \S+ does not exist|Unresolved reference|NoSuchMethodError|NoClassDefFoundError/i,
  lockfiles: ["pom.xml", "build.gradle", "build.gradle.kts", "settings.gradle", "settings.gradle.kts", "gradle/libs.versions.toml", "gradle/wrapper/gradle-wrapper.properties"],
};

// Ruby: RSpec's JSON report is turned into JUnit by a small converter, so the repository needs no extra gem.
const RSPEC_TO_JUNIT = `require "json"
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
const RUBY_INSTALL = "command -v ruby >/dev/null 2>&1 || (sudo apt-get update -qq >/dev/null && sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq ruby-full >/dev/null)";
const BUNDLE_ENV = 'export BUNDLE_PATH="$PWD/.aftershock-bundle" BUNDLE_DISABLE_SHARED_GEMS=true';
const rspecRun = (t: string, j: string) =>
  `${BUNDLE_ENV} && (bundle exec rspec ${q(t)} --format json --out .aftershock-out/rspec.json > .aftershock-out/rspec.log 2>&1; true) && ruby .aftershock-out/rspec_junit.rb .aftershock-out/rspec.json .aftershock-out/rspec.log > ${q(j)}; tail -n 40 .aftershock-out/rspec.log`;

const rspec: FrameworkDef = {
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
  lockfiles: ["Gemfile", "Gemfile.lock", ".ruby-version"],
};

const DEFS: Record<Framework, FrameworkDef> = { pytest, vitest: js("vitest"), jest: js("jest"), go, junit, rspec };

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
  if ((await read("pom.xml")) !== null || (await read("build.gradle")) !== null || (await read("build.gradle.kts")) !== null) return { framework: "junit", install: "true", language: "Java" };
  if ((await read("Gemfile")) !== null) return { framework: "rspec", install: "bundle install", language: "Ruby" };
  if ((await read("go.mod")) !== null) return { framework: "go", install: "go mod download", language: "Go" };
  if ((await read("requirements.txt")) !== null) return { framework: "pytest", install: "pip install -r requirements.txt", language: "Python" };
  if ((await read("pyproject.toml")) !== null) return { framework: "pytest", install: "pip install -e .", language: "Python" };
  return { framework: "pytest", install: "true", language: "Python" };
}
