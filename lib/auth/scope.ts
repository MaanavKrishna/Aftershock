import "server-only";
import { requireSession } from "./session";
import { scoped } from "@/lib/db/queries/scope";

export async function currentScope() {
  const session = await requireSession();
  return { session, scope: scoped(session.workspaceId) };
}

/** The signed-in member's role, checked against an action. */
export async function authorize(action: import("./roles").Action) {
  const { can } = await import("./roles");
  const ctx = await currentScope();
  const me = await ctx.scope.me(ctx.session.userId);
  return { ...ctx, role: me?.role ?? null, allowed: can(me?.role, action) };
}
