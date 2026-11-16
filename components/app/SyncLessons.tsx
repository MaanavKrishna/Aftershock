"use client";
import { useActionState } from "react";
import { syncLessonsAction, type FormState } from "@/app/(app)/actions";
import { buttonClass } from "@/components/ui/Button";
import { FormMessage, inputClass } from "@/components/ui/Field";

export function SyncLessons({ repos }: { repos: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(syncLessonsAction, {});
  return (
    <form action={action} className="flex flex-col gap-2 border-t border-border-soft px-5 py-4">
      <div className="flex flex-wrap items-center gap-2">
        {repos.length > 1 ? (
          <select name="repoId" aria-label="Repository" className={`${inputClass} w-auto min-w-0 flex-1 px-2.5`}>
            {repos.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        ) : (
          <input type="hidden" name="repoId" value={repos[0]?.id ?? ""} />
        )}
        <button type="submit" disabled={pending || repos.length === 0} className={buttonClass("secondary", "md")}>
          {pending ? "Opening…" : "Sync to AGENTS.md"}
        </button>
      </div>
      <FormMessage error={state.error} ok={state.ok} />
    </form>
  );
}
