import "server-only";
import { redirect } from "next/navigation";
import { requireSession } from "./session";
import { sessionActive } from "./sessions";
import { scoped } from "@/lib/db/queries/scope";

/** The signed-in member and their workspace. Revoked, idle or expired sessions, and ex-members, go back to sign in. */
export async function currentScope() {
  const session = await requireSession();
  if (!(await sessionActive(session))) redirect("/signin?error=no_access");
  return { session, scope: scoped(session.workspaceId) };
}

/** The signed-in member's role, checked against an action. */
export async function authorize(action: import("./roles").Action) {
  const { can } = await import("./roles");
  const ctx = await currentScope();
  const me = await ctx.scope.me(ctx.session.userId);
  return { ...ctx, role: me?.role ?? null, allowed: can(me?.role, action) };
}
