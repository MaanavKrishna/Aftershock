import { test, expect } from "vitest";
import { allowanceMs, isBot, planFor } from "@/lib/billing/plans";

const H = 3_600_000;

test("sandbox hours follow the plan and the number of active committers", () => {
  expect(allowanceMs("free", 3)).toBe(5 * H);
  expect(allowanceMs("free", 40)).toBe(5 * H);
  expect(allowanceMs("team", 4)).toBe(60 * H);
  expect(allowanceMs("team", 0)).toBe(15 * H);
  expect(allowanceMs("business", 10)).toBe(150 * H);
  expect(planFor("unknown").id).toBe("free");
});

test("bots never count as committers", () => {
  expect(isBot({ login: "dependabot[bot]", type: "Bot" })).toBe(true);
  expect(isBot({ login: "renovate[bot]" })).toBe(true);
  expect(isBot({ login: "aftershock-by-maanavkrishna", type: "Bot" })).toBe(true);
  expect(isBot({ login: "maanav", type: "User" })).toBe(false);
});
