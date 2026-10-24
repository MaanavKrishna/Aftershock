import { test, expect } from "vitest";
import { flagEnabled, runsDisabled } from "@/lib/flags";

test("flags default off, follow workspace settings, and env overrides win", () => {
  expect(flagEnabled("installCache", {}, {})).toBe(false);
  expect(flagEnabled("installCache", { flags: { installCache: true } }, {})).toBe(true);
  expect(flagEnabled("installCache", { flags: { installCache: true } }, { AFTERSHOCK_FLAG_INSTALL_CACHE: "off" })).toBe(false);
  expect(flagEnabled("installCache", {}, { AFTERSHOCK_FLAG_INSTALL_CACHE: "on" })).toBe(true);
});

test("the kill switch pauses runs", () => {
  expect(runsDisabled({})).toBe(false);
  expect(runsDisabled({ AFTERSHOCK_RUNS_DISABLED: "1" })).toBe(true);
});
