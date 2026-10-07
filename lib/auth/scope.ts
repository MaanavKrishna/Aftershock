import "server-only";
import { requireSession } from "./session";
import { scoped } from "@/lib/db/queries/scope";

export async function currentScope() {
  const session = await requireSession();
  return { session, scope: scoped(session.workspaceId) };
}
