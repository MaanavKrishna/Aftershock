import { test, expect } from "vitest";
import { csvCell, toCsv } from "@/lib/data/csv";

test("plain cells pass through; empty values are empty", () => {
  expect(csvCell("token.created")).toBe("token.created");
  expect(csvCell(null)).toBe("");
  expect(csvCell(undefined)).toBe("");
  expect(csvCell(42)).toBe("42");
});

test("quotes, commas and line breaks are quoted with quotes doubled", () => {
  expect(csvCell('say "hi"')).toBe('"say ""hi"""');
  expect(csvCell("a,b")).toBe('"a,b"');
  expect(csvCell("a\nb")).toBe('"a\nb"');
  expect(csvCell("a\r\nb")).toBe('"a\r\nb"');
});

test("cells a spreadsheet would run as formulas start with an apostrophe", () => {
  for (const c of ["=1+1", "+1", "-1", "@SUM(A1)", "\tx", "\rx"]) expect(csvCell(c).replace(/^"/, "").startsWith("'")).toBe(true);
  expect(csvCell('=HYPERLINK("x","y")')).toBe(`"'=HYPERLINK(""x"",""y"")"`);
  expect(csvCell("a=b")).toBe("a=b");
});

test("rows end in CRLF", () => {
  expect(toCsv(["a", "b"], [["1", "x,y"]])).toBe('a,b\r\n1,"x,y"\r\n');
});
