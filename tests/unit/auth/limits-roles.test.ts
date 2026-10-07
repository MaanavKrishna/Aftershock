import { test, expect } from "vitest";
import { createLimiter } from "@/lib/http/rateLimit";
import { can } from "@/lib/auth/roles";

test("a limiter allows up to the limit per window, per key", () => {
  let now = 0;
  const limit = createLimiter({ limit: 3, windowMs: 1000, now: () => now });
  expect([1, 2, 3, 4].map(() => limit("a").ok)).toEqual([true, true, true, false]);
  expect(limit("b").ok).toBe(true);
  now = 1001;
  expect(limit("a").ok).toBe(true);
});

test("a refused request says when to retry", () => {
  const limit = createLimiter({ limit: 1, windowMs: 60_000, now: () => 0 });
  limit("a");
  expect(limit("a")).toEqual({ ok: false, retryAfterSeconds: 60 });
});

test("only owners and admins can override checks or manage secrets and tokens", () => {
  for (const action of ["override", "manageIntegrations", "manageTokens", "manageWorkspace"] as const) {
    expect(can("owner", action)).toBe(true);
    expect(can("admin", action)).toBe(true);
    expect(can("member", action)).toBe(false);
  }
  expect(can("member", "recordIncident")).toBe(true);
});
