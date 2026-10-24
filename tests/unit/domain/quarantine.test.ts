import { test, expect } from "vitest";
import { quarantineDecision } from "@/lib/domain/quarantine";

const n = (s: string) => [...s].map((c) => c === "1");

test("a test that keeps flipping on main is quarantined, with the reason", () => {
  expect(quarantineDecision(n("1101101"), false)).toEqual({ quarantined: true, reason: "Flaky on main: failed 2 of the last 7 nights" });
});

test("a test failing every night is a real failure, not flakiness", () => {
  expect(quarantineDecision(n("1110000"), false).quarantined).toBe(false);
});

test("one bad night is not enough", () => {
  expect(quarantineDecision(n("1111011"), false).quarantined).toBe(false);
});

test("seven green nights in a row release a quarantined test", () => {
  expect(quarantineDecision(n("0" + "1".repeat(6)), true).quarantined).toBe(true);
  expect(quarantineDecision(n("0" + "1".repeat(7)), true)).toEqual({ quarantined: false, reason: null });
});

test("a released test is not quarantined again by failures from before its release", () => {
  expect(quarantineDecision(n("10101" + "1".repeat(7)), false).quarantined).toBe(false);
});
