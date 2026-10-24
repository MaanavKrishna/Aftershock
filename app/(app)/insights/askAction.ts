"use server";
import { currentScope } from "@/lib/auth/scope";
import type { Answer } from "@/lib/model/ask";

export type AskState = { question?: string; result?: Answer; error?: string };

export async function askAction(_p: AskState, form: FormData): Promise<AskState> {
  const { session } = await currentScope();
  const question = String(form.get("question") ?? "").trim();
  if (question.length < 4) return { error: "Ask a question about your incidents." };
  const { askAftershock } = await import("@/lib/model/ask");
  return { question, result: await askAftershock(session.workspaceId, question) };
}
