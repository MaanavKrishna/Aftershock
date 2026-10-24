import { test, expect } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { scoped } from "@/lib/db/queries/scope";
import { ledgerWorld } from "../support/world";

test("deleting a user keeps their notes on the incident trail, without an author", async () => {
  const w = await ledgerWorld();
  const db = await getDb();
  const [u] = await db.insert(s.users).values({ githubId: String(Math.random()), login: "leaver" }).returning();
  await db.insert(s.notes).values({ incidentId: w.incident.id, userId: u.id, text: "Root cause was the retry" });
  await db.delete(s.users).where(eq(s.users.id, u.id));
  const notes = await scoped(w.ws.id).notes(w.incident.id);
  expect(notes.map((n) => n.note.text)).toEqual(["Root cause was the retry"]);
  expect(notes[0].user).toBeNull();
});
