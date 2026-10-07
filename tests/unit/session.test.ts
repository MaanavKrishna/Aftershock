import { test, expect } from "vitest";
import { signSession, verifySession } from "@/lib/auth/token";

test("a signed session verifies to the same ids", async () => {
  const token = await signSession({ userId: "u1", workspaceId: "w1" });
  expect(await verifySession(token)).toEqual({ userId: "u1", workspaceId: "w1" });
});

test("a tampered session is rejected", async () => {
  const token = await signSession({ userId: "u1", workspaceId: "w1" });
  const [h, p, sig] = token.split(".");
  const forged = Buffer.from(JSON.stringify({ userId: "u1", workspaceId: "other" })).toString("base64url");
  expect(await verifySession(`${h}.${forged}.${sig}`)).toBeNull();
  expect(await verifySession(`${h}.${p}.${sig[0] === "A" ? "B" : "A"}${sig.slice(1)}`)).toBeNull();
});

test("an expired session is rejected", async () => {
  const token = await signSession({ userId: "u1", workspaceId: "w1" }, -60);
  expect(await verifySession(token)).toBeNull();
});

test("garbage is rejected", async () => {
  expect(await verifySession("not-a-token")).toBeNull();
  expect(await verifySession(undefined)).toBeNull();
});
