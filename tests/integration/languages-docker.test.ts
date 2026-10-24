import { describe, test, expect } from "vitest";
import { DockerRunner } from "@/lib/runner/docker";
import { dockerAvailable, goRepo, GO_TEST, mavenRepo, JAVA_TEST, rubyRepo, RUBY_SPEC, monoRepo, playwrightRepo, PLAYWRIGHT_TEST } from "../support/fixtureRepo";
import type { RunSpec } from "@/lib/runner/types";

const prove = async (spec: Omit<RunSpec, "sha" | "runs" | "timeoutMs">, parent: string, fix: string) => {
  const runner = new DockerRunner();
  const before = await runner.run({ ...spec, sha: parent, runs: 1, timeoutMs: 300_000 });
  const after = await runner.run({ ...spec, sha: fix, runs: 1, timeoutMs: 300_000 });
  return { before: before.results.map((r) => r.outcome), after: after.results.map((r) => r.outcome), log: `${before.log}\n${after.log}` };
};

describe.skipIf(!dockerAvailable())("languages, proven in Docker", () => {
  test("Playwright: a browser test of the app fails before the fix and passes on it", async () => {
    const repo = playwrightRepo();
    const r = await prove({ repoUrl: repo.dir, framework: "playwright", install: "npm install --no-audit --no-fund", testPath: "e2e/aftershock/cart_total.spec.js", testCode: PLAYWRIGHT_TEST }, repo.parent, repo.fix);
    expect(r, r.log.slice(-3000)).toMatchObject({ before: ["failed"], after: ["passed"] });
  }, 1_200_000);

  test("Go: the drafted test fails before the fix and passes on it", async () => {
    const repo = goRepo();
    const r = await prove({ repoUrl: repo.dir, framework: "go", install: "go mod download", testPath: "cart/aftershock_negative_total_test.go", testCode: GO_TEST }, repo.parent, repo.fix);
    expect(r, r.log).toMatchObject({ before: ["failed"], after: ["passed"] });
  }, 600_000);

  test("Java (Maven): the drafted test fails before the fix and passes on it", async () => {
    const repo = mavenRepo();
    const r = await prove({ repoUrl: repo.dir, framework: "junit", install: "true", testPath: "src/test/java/shop/AftershockNegativeTotalTest.java", testCode: JAVA_TEST }, repo.parent, repo.fix);
    expect(r, r.log).toMatchObject({ before: ["failed"], after: ["passed"] });
  }, 900_000);

  test("Java: a test that calls code that does not exist yet reads as missing code", async () => {
    const repo = mavenRepo();
    const missing = JAVA_TEST.replace("Cart.total(1500, 2500)", "Cart.totalAfterCoupons(1500, 2500)");
    const r = await new DockerRunner().run({ repoUrl: repo.dir, framework: "junit", install: "true", sha: repo.fix, runs: 1, timeoutMs: 300_000, testPath: "src/test/java/shop/AftershockNegativeTotalTest.java", testCode: missing });
    const { codeAbsent } = await import("@/lib/runner/junit");
    expect(codeAbsent(r.results[0]), JSON.stringify(r.results)).toBe(true);
  }, 900_000);

  test("Ruby (RSpec): the drafted spec fails before the fix and passes on it", async () => {
    const repo = rubyRepo();
    const r = await prove({ repoUrl: repo.dir, framework: "rspec", install: "bundle install", testPath: "spec/aftershock/negative_total_spec.rb", testCode: RUBY_SPEC }, repo.parent, repo.fix);
    expect(r, r.log).toMatchObject({ before: ["failed"], after: ["passed"] });
  }, 900_000);

  test("Ruby: a spec for a class that does not exist yet reads as missing code", async () => {
    const repo = rubyRepo();
    const r = await new DockerRunner().run({ repoUrl: repo.dir, framework: "rspec", install: "bundle install", sha: repo.fix, runs: 1, timeoutMs: 300_000, testPath: "spec/aftershock/missing_spec.rb", testCode: RUBY_SPEC.replace("Cart.total", "Checkout.total").replace("RSpec.describe Cart", "RSpec.describe Checkout") });
    const { codeAbsent } = await import("@/lib/runner/junit");
    expect(codeAbsent(r.results[0]), JSON.stringify(r.results)).toBe(true);
  }, 900_000);

  test("monorepo: a Go package in a subfolder is installed and proven inside that folder", async () => {
    const repo = monoRepo();
    const r = await prove({ repoUrl: repo.dir, framework: "go", install: "go mod download", workdir: "services/api", testPath: "services/api/cart/aftershock_negative_total_test.go", testCode: GO_TEST }, repo.parent, repo.fix);
    expect(r, r.log).toMatchObject({ before: ["failed"], after: ["passed"] });
  }, 600_000);
});
