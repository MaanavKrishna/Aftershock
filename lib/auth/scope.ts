import "server-only";
import { redirect } from "next/navigation";
import { requireSession } from "./session";
import { isMember } from "./membership";
import { scoped } from "@/lib/db/queries/scope";

/** The signed-in member and their workspace. Sends anyone who is no longer a member back to sign in. */
export async function currentScope() {
  const session = await requireSession();
  if (!(await isMember(session))) redirect("/signin?error=no_access");
  return { session, scope: scoped(session.workspaceId) };
}

/** The signed-in member's role, checked against an action. */
export async function authorize(action: import("./roles").Action) {
  const { can } = await import("./roles");
  const ctx = await currentScope();
  const me = await ctx.scope.me(ctx.session.userId);
  return { ...ctx, role: me?.role ?? null, allowed: can(me?.role, action) };
}
