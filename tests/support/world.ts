import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { makeLedgerRepo } from "./fixtureRepo";

/** A fresh workspace with the ledger fixture repo and one incident pointing at its fix. */
export async function ledgerWorld(fix: "sha" | "root" | "missing" = "sha") {
  const db = await getDb();
  const repo = makeLedgerRepo();
  const login = `ws-${crypto.randomUUID().slice(0, 8)}`;
  const [ws] = await db.insert(s.workspaces).values({ login, name: login }).returning();
  const [r] = await db.insert(s.repositories).values({ workspaceId: ws.id, fullName: `local/${login}`, name: "ledger", cloneUrl: repo.dir, framework: "pytest", installCmd: "pip install -q -r requirements.txt" }).returning();
  const { execFileSync } = await import("node:child_process");
  const root = execFileSync("git", ["-C", repo.dir, "rev-list", "--max-parents=0", "HEAD"], { encoding: "utf8" }).trim();
  const fixSha = fix === "sha" ? repo.fix : fix === "root" ? root : "deadbeefdeadbeef";
  const [inc] = await db
    .insert(s.incidents)
    .values({ workspaceId: ws.id, repoId: r.id, number: 1, title: "Retry charged twice", trigger: "client retried", observed: "two payments", expected: "retry rejected with 400", source: "form", status: "awaiting_fix", fixSha })
    .returning();
  const reload = async () => (await db.select().from(s.incidents).where(eq(s.incidents.id, inc.id)))[0];
  const runs = async () => db.select().from(s.timeTravelRuns).where(eq(s.timeTravelRuns.incidentId, inc.id)).orderBy(s.timeTravelRuns.attempt);
  const memory = async () => db.select().from(s.memoryTests).where(eq(s.memoryTests.incidentId, inc.id));
  return { ws, repo: r, git: repo, incident: inc, reload, runs, memory };
}
