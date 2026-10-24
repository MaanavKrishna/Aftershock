import { test, expect } from "vitest";
import { resolvePackage } from "@/lib/domain/packages";

const packages = [{ path: "services/api" }, { path: "services/api/billing" }, { path: "apps/web" }];

test("the package is the longest path that contains the fix's changed code", () => {
  expect(resolvePackage(["services/api/billing/charge.go", "services/api/billing/charge_test.go"], packages)?.path).toBe("services/api/billing");
  expect(resolvePackage(["apps/web/src/cart.ts"], packages)?.path).toBe("apps/web");
});

test("the package touched by most changed files wins when a fix spans packages", () => {
  expect(resolvePackage(["apps/web/a.ts", "apps/web/b.ts", "services/api/x.go"], packages)?.path).toBe("apps/web");
});

test("changes outside every package use the repository root", () => {
  expect(resolvePackage(["README.md"], packages)).toBeNull();
  expect(resolvePackage(["apps/website/x.ts"], packages)).toBeNull();
});
