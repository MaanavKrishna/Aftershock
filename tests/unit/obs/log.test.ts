import { test, expect } from "vitest";
import { formatLog } from "@/lib/obs/log";

test("a log line is one JSON object with level, message and fields", () => {
  const line = formatLog("info", "time travel started", { requestId: "r1", incidentId: "i1" }, new Date("2026-10-24T00:00:00Z"));
  expect(JSON.parse(line)).toEqual({ time: "2026-10-24T00:00:00.000Z", level: "info", msg: "time travel started", requestId: "r1", incidentId: "i1" });
  expect(line).not.toContain("\n");
});

test("secrets are redacted and long values are truncated", () => {
  const out = JSON.parse(formatLog("warn", "x", { token: "abc", apiKey: "k", authorization: "Bearer z", webhookSecret: "s", password: "p", note: "a".repeat(5000) }));
  expect(out.token).toBe("[redacted]");
  expect(out.apiKey).toBe("[redacted]");
  expect(out.authorization).toBe("[redacted]");
  expect(out.webhookSecret).toBe("[redacted]");
  expect(out.password).toBe("[redacted]");
  expect(out.note.length).toBeLessThanOrEqual(2001);
});

test("errors are serialised with name, message and a short stack", () => {
  const out = JSON.parse(formatLog("error", "boom", { err: new TypeError("bad thing") }));
  expect(out.err.name).toBe("TypeError");
  expect(out.err.message).toBe("bad thing");
  expect(typeof out.err.stack).toBe("string");
});
