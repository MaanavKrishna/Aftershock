import { test, expect } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { epicenter } from "@/lib/workflows/epicenter";
import { setDeps } from "@/lib/timetravel/deps";
import { DockerRunner } from "@/lib/runner/docker";
import { LEDGER_TEST, dockerAvailable } from "../support/fixtureRepo";

const GOOD = "PAYMENTS = []\n\n\ndef pay(order_id):\n    if order_id in PAYMENTS:\n        return 400\n    PAYMENTS.append(order_id)\n    return 201\n";
const BAD = "PAYMENTS = []\n\n\ndef pay(order_id):\n    PAYMENTS.append(order_id)\n    return 201\n";

test.skipIf(!dockerAvailable())("epicenter finds the refactor that removed the guard", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aftershock-epi-"));
  const git = (...a: string[]) => execFileSync("git", ["-C", dir, ...a], { encoding: "utf8" }).trim();
  git("init", "-q", "-b", "main");
  git("config", "user.email", "f@example.invalid");
  git("config", "user.name", "F");
  fs.writeFileSync(path.join(dir, "requirements.txt"), "");
  fs.writeFileSync(path.join(dir, "ledger.py"), GOOD);
  git("add", "-A"); git("commit", "-qm", "feat: payments with guard");
  fs.writeFileSync(path.join(dir, "ledger.py"), BAD);
  git("commit", "-qam", "refactor: simplify payments (#31)");
  const introduced = git("rev-parse", "HEAD");
  fs.writeFileSync(path.join(dir, "README.md"), "docs\n");
  git("add", "-A"); git("commit", "-qm", "docs: readme");
  const parent = git("rev-parse", "HEAD");
  fs.writeFileSync(path.join(dir, "ledger.py"), GOOD);
  git("commit", "-qam", "fix: restore guard");

  const db = await getDb();
  const login = `epi-${crypto.randomUUID().slice(0, 8)}`;
  const [ws] = await db.insert(s.workspaces).values({ login, name: login }).returning();
  const [repo] = await db.insert(s.repositories).values({ workspaceId: ws.id, fullName: `l/${login}`, name: "ledger", cloneUrl: dir, framework: "pytest", installCmd: "pip install -q -r requirements.txt" }).returning();
  const [inc] = await db.insert(s.incidents).values({ workspaceId: ws.id, repoId: repo.id, number: 1, title: "dup", source: "form", status: "proven", parentSha: parent }).returning();
  const [mem] = await db.insert(s.memoryTests).values({ workspaceId: ws.id, incidentId: inc.id, repoId: repo.id, path: "tests/aftershock/test_inc_1.py", fn: "test_retry_is_rejected", code: LEDGER_TEST }).returning();
  setDeps({ runner: () => new DockerRunner(), drafter: () => ({ draft: async () => { throw new Error("unused"); } }), openBotPr: async () => null });
  await epicenter(mem.id);
  const [after] = await db.select().from(s.incidents).where(eq(s.incidents.id, inc.id));
  expect(after.epicenter).toMatchObject({ sha: introduced.slice(0, 7), prNumber: 31 });
}, 600_000);
