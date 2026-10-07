import { test, expect } from "vitest";
import { fieldsFromIssue } from "@/lib/domain/issueBody";

test("bold, heading and colon sections become trigger, observed and expected", () => {
  const body = [
    "**What happened**", "A $25 coupon on a $15 cart.", "",
    "## Trigger", "`Cart` with one item, coupon 2500.", "",
    "Observed: `total_cents()` returns `-1000`.", "",
    "### Expected behaviour", "The total never goes below zero.",
  ].join("\n");
  expect(fieldsFromIssue(body)).toEqual({
    trigger: "`Cart` with one item, coupon 2500.",
    observed: "A $25 coupon on a $15 cart.\n\n`total_cents()` returns `-1000`.",
    expected: "The total never goes below zero.",
  });
});

test("an unstructured body is all observed", () => {
  expect(fieldsFromIssue("It broke after deploy.\nSee logs.")).toEqual({ trigger: "", observed: "It broke after deploy.\nSee logs.", expected: "" });
  expect(fieldsFromIssue("")).toEqual({ trigger: "", observed: "", expected: "" });
});
