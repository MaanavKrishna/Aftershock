import { test, expect } from "vitest";
import { incidentKey, parseIncidentRefs } from "@/lib/domain/ids";
import { renderLessons } from "@/lib/domain/lessons";

test("incidentKey formats prefix and number", () => {
  expect(incidentKey("INC", 12)).toBe("INC-12");
});

test("parseIncidentRefs finds references case-insensitively, word-bounded, deduplicated", () => {
  expect(parseIncidentRefs("Fixes INC-12 and inc-7; also INC-12. Not XINC-3 or INC-", "INC")).toEqual([12, 7]);
});

test("renderLessons produces a markdown file with one section per lesson", () => {
  const md = renderLessons([
    { key: "INC-12", title: "Payment retry charged twice", files: ["app/services/payment_service.py"], expected: "Retry is rejected with 400", testPath: "tests/aftershock/test_inc_12.py" },
  ]);
  expect(md).toMatch(/^# Lessons from production \(Aftershock\)/);
  expect(md).toContain("## INC-12 · app/services/payment_service.py");
  expect(md).toContain("Test: tests/aftershock/test_inc_12.py");
});
