"use client";
import { useActionState } from "react";
import { syncLessonsAction, type FormState } from "@/app/(app)/actions";

export function SyncLessons({ repos }: { repos: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(syncLessonsAction, {});
  return (
    <form action={action} className="flex flex-col gap-2 border-t border-[#222C38] px-5 py-4">
      <div className="flex flex-wrap items-center gap-2">
        {repos.length > 1 ? (
          <select name="repoId" aria-label="Repository" className="min-h-10 rounded-lg border border-[#2E3A48] bg-[#141B24] px-2 text-[13px] text-white">{repos.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
        ) : (
          <input type="hidden" name="repoId" value={repos[0]?.id ?? ""} />
        )}
        <button type="submit" disabled={pending || repos.length === 0} className="min-h-10 cursor-pointer rounded-lg bg-card px-3.5 text-[13px] font-semibold text-ink">{pending ? "Opening…" : "Sync to AGENTS.md"}</button>
      </div>
      {state.error && <p role="alert" className="m-0 text-[12.5px] text-[#FFB59A]">{state.error}</p>}
      {state.ok && <p role="status" className="m-0 text-[12.5px] text-[#9FE3C0]">{state.ok}</p>}
    </form>
  );
}
