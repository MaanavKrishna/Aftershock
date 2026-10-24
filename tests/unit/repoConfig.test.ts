import { test, expect } from "vitest";
import { parseRepoConfig, applyRepoConfig } from "@/lib/config/repoConfig";

const YAML = `# Aftershock
framework: vitest            # pytest | vitest | jest
runner: actions
install: "npm ci --ignore-scripts"
test_dir: test/regressions/
check:
  mode: advisory
  runs: 3
incidents:
  issue_label: postmortem
`;

test("reads the supported keys, ignoring comments and quotes", () => {
  expect(parseRepoConfig(YAML)).toEqual({ framework: "vitest", runner: "actions", installCmd: "npm ci --ignore-scripts", testDir: "test/regressions", checkMode: "advisory", issueLabel: "postmortem" });
});

test("invalid values are ignored rather than trusted", () => {
  expect(parseRepoConfig("framework: mocha\nrunner: laptop\ntest_dir: ../../etc\ncheck:\n  mode: maybe\n")).toEqual({});
});

test("repository settings are overridden only by what the file sets", () => {
  const repo = { framework: "pytest" as const, installCmd: "pip install -r requirements.txt", testDir: "tests/aftershock", runner: "sandbox" as const, checkMode: "blocking" as const };
  expect(applyRepoConfig(repo, { checkMode: "advisory" })).toEqual({ ...repo, checkMode: "advisory" });
});

test("an empty or missing file changes nothing", () => {
  expect(parseRepoConfig("")).toEqual({});
});

test("a monorepo lists packages, each with its own path, framework, install and test folder", () => {
  const cfg = parseRepoConfig(`framework: vitest
packages:
  - path: services/api
    framework: go
    install: go mod download
  - path: apps/web/
    framework: vitest
    install: npm ci
    test_dir: tests/aftershock
  - path: ../escape
    framework: go
`);
  expect(cfg.framework).toBe("vitest");
  expect(cfg.packages).toEqual([
    { path: "services/api", framework: "go", installCmd: "go mod download" },
    { path: "apps/web", framework: "vitest", installCmd: "npm ci", testDir: "tests/aftershock" },
  ]);
});
