import { test, expect } from "vitest";
import { redactToken, SCRUB_GIT_CREDENTIALS } from "@/lib/runner/secrets";

test("a clone token never survives into stored output", () => {
  const token = "ghs_abcdefghijklmnopqrstuvwxyz0123456789";
  const out = `remote: https://x-access-token:${token}@github.com/o/r.git\nprinted ${token}\n`;
  const clean = redactToken(out, token);
  expect(clean).not.toContain(token);
  expect(clean).toContain("[redacted]");
  expect(redactToken("nothing here", undefined)).toBe("nothing here");
});

test("credentials are scrubbed from the checkout before untrusted code runs", () => {
  expect(SCRUB_GIT_CREDENTIALS).toContain("git remote remove origin");
  expect(SCRUB_GIT_CREDENTIALS).toContain(".git-credentials");
});
