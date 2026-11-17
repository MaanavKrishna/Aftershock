import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor } from "@/lib/db/queries/paging";

const raw = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");

describe("decodeCursor", () => {
  it("round-trips a valid timestamp cursor", () => {
    const c = encodeCursor("check", "2026-11-16T21:19:10.831000Z", "abc");
    expect(decodeCursor("check", c, "string")).toEqual({ key: "2026-11-16T21:19:10.831000Z", id: "abc" });
  });

  it("starts over on a timestamp that has the right shape but is not a real date", () => {
    expect(decodeCursor("check", raw(["check", "2024-13-45T99:61:61.000000Z", "abc"]), "string")).toBeNull();
    expect(decodeCursor("audit", raw(["audit", "2025-02-30T10:00:00.000000Z", "abc"]), "string")).toBeNull();
  });

  it("starts over on a numeric key outside the integer column's range", () => {
    expect(decodeCursor("incident", raw(["incident", 2 ** 31, "abc"]), "number")).toBeNull();
    expect(decodeCursor("incident", raw(["incident", 0, "abc"]), "number")).toBeNull();
    expect(decodeCursor("incident", raw(["incident", -5, "abc"]), "number")).toBeNull();
  });

  it("accepts the largest incident number Postgres can store", () => {
    expect(decodeCursor("incident", raw(["incident", 2 ** 31 - 1, "abc"]), "number")).toEqual({ key: 2 ** 31 - 1, id: "abc" });
  });
});
