import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import type { GithubUser } from "./github-oauth";

/** Upserts the GitHub user and their personal workspace; organisation workspaces appear when the GitHub App is installed. */
export async function upsertGithubAccount(u: GithubUser): Promise<{ userId: string; workspaceId: string }> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [user] = await tx
      .insert(s.users)
      .values({ githubId: String(u.id), login: u.login, name: u.name, avatarUrl: u.avatar_url })
      .onConflictDoUpdate({ target: s.users.githubId, set: { login: u.login, name: u.name, avatarUrl: u.avatar_url } })
      .returning();
    const [existing] = await tx.select().from(s.memberships).where(eq(s.memberships.userId, user.id));
    if (existing) return { userId: user.id, workspaceId: existing.workspaceId };
    const [ws] = await tx
      .insert(s.workspaces)
      .values({ login: u.login, name: u.name ?? u.login, settings: { autoImportIssues: true, autoTravelOnMerge: true, issueLabel: "incident" } })
      .onConflictDoUpdate({ target: s.workspaces.login, set: { name: u.name ?? u.login } })
      .returning();
    await tx.insert(s.memberships).values({ workspaceId: ws.id, userId: user.id, role: "owner" }).onConflictDoNothing();
    return { userId: user.id, workspaceId: ws.id };
  });
}
