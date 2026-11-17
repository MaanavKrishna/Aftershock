"use client";
import { useActionState } from "react";
import { syncLessonsAction, type FormState } from "@/app/(app)/actions";
import { SelectField, FormMessage } from "@/components/ui/Field";
import { buttonClass } from "@/components/ui/Button";

/** Opens a pull request that writes the lessons into a repository's AGENTS.md. */
export function LessonsSync({ repos }: { repos: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(syncLessonsAction, {});
  return (
    <form action={action} className="flex flex-col gap-2 border-t border-border-soft px-5 py-4" aria-busy={pending}>
      <div className="flex flex-wrap items-end gap-2">
        {repos.length > 1 ? (
          <SelectField label="Repository" name="repoId" className="min-w-40 flex-1">
            {repos.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </SelectField>
        ) : (
          <input type="hidden" name="repoId" value={repos[0]?.id ?? ""} />
        )}
        <button type="submit" disabled={pending || repos.length === 0} className={buttonClass("secondary")}>
          {pending ? "Opening…" : "Sync to AGENTS.md"}
        </button>
      </div>
      <FormMessage error={state.error} ok={state.ok} />
    </form>
  );
}
