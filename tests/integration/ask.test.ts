import { test, expect, afterEach } from "vitest";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { setModelClient } from "@/lib/model/provider";
import { askAftershock } from "@/lib/model/ask";

afterEach(() => setModelClient(null));

async function world() {
  const db = await getDb();
  const login = `ask-${crypto.randomUUID().slice(0, 8)}`;
  const [ws] = await db.insert(s.workspaces).values({ login, name: login }).returning();
  await db.insert(s.incidents).values([
    { workspaceId: ws.id, number: 3, title: "Checkout totals overflow", observed: "cart total wrong for large orders", expected: "totals use Decimal", source: "form", status: "proven", watchedFiles: ["app/checkout/cart.py"] },
    { workspaceId: ws.id, number: 7, title: "Refund rounds down", observed: "refunds lose a cent", expected: "refund equals charge", source: "form", status: "proven", watchedFiles: ["app/refunds.py"] },
  ]);
  return ws;
}

test("answers from the matching incidents and cites them", async () => {
  const ws = await world();
  const seen: string[] = [];
  setModelClient(async (_c, messages) => (seen.push(messages.map((m) => m.content).join("\n")), { text: JSON.stringify({ answer: "Checkout broke when totals overflowed (INC-3).", cite: ["INC-3"] }), model: "m" }));
  const r = await askAftershock(ws.id, "What breaks when we touch checkout?");
  expect(r.answer).toContain("INC-3");
  expect(r.citations.map((c) => c.key)).toEqual(["INC-3"]);
  expect(r.citations[0].url).toMatch(/\/incidents\/3$/);
  expect(seen[0]).toContain("<<<UNTRUSTED");
  expect(seen[0]).toContain("Checkout totals overflow");
});

test("citations the model made up are dropped; with none left, there is no answer", async () => {
  const ws = await world();
  setModelClient(async () => ({ text: JSON.stringify({ answer: "INC-99 did it.", cite: ["INC-99"] }), model: "m" }));
  const r = await askAftershock(ws.id, "what happened with refunds?");
  expect(r.answered).toBe(false);
  expect(r.citations.map((c) => c.key)).toContain("INC-7");
  expect(r.answer).toMatch(/couldn't answer/i);
});

test("nothing relevant means no model call at all", async () => {
  const ws = await world();
  let calls = 0;
  setModelClient(async () => (calls++, { text: "{}", model: "m" }));
  const r = await askAftershock(ws.id, "kubernetes ingress tls?");
  expect(calls).toBe(0);
  expect(r).toMatchObject({ answered: false, citations: [] });
});

test("broken model output falls back to the relevant incidents", async () => {
  const ws = await world();
  setModelClient(async () => ({ text: "sure! here you go", model: "m" }));
  const r = await askAftershock(ws.id, "checkout totals");
  expect(r.answered).toBe(false);
  expect(r.citations[0].key).toBe("INC-3");
});
