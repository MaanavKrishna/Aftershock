"use client";
import { useActionState } from "react";
import { editIncident, type FormState } from "@/app/(app)/actions";

const input = "w-full rounded-[9px] border border-field bg-card px-3 py-2 text-[14px] font-normal text-ink";

/** Correct an incident's title and its trigger, observed and expected text. */
export function EditIncident({ id, title, trigger, observed, expected }: { id: string; title: string; trigger: string; observed: string; expected: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(editIncident, {});
  return (
    <details className="group border-t border-line-soft">
      <summary className="flex min-h-11 cursor-pointer list-none items-center px-[22px] text-[13px] font-semibold text-muted hover:text-ink [&::-webkit-details-marker]:hidden">Edit details</summary>
      <form action={action} className="flex flex-col gap-3 px-[22px] pb-5">
        <input type="hidden" name="incidentId" value={id} />
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Title<input name="title" defaultValue={title} required maxLength={200} className={input} /></label>
        {([["trigger", "Trigger", trigger], ["observed", "Observed", observed], ["expected", "Expected", expected]] as const).map(([name, label, value]) => (
          <label key={name} className="flex flex-col gap-1.5 text-[13px] font-semibold">{label}<textarea name={name} defaultValue={value} rows={3} maxLength={4000} className={`${input} resize-y`} /></label>
        ))}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={pending} className="min-h-[42px] cursor-pointer rounded-[9px] bg-ink px-4 font-semibold text-paper">{pending ? "Saving…" : "Save details"}</button>
          {state.error && <span role="alert" className="text-[13px] text-fail-deep">{state.error}</span>}
          {state.ok && <span role="status" className="text-[13px] text-pass">{state.ok}</span>}
        </div>
        <p className="m-0 text-[12.5px] text-muted">Agents and lessons use the expected behaviour, so keep it specific. Edits don’t change a proof that already ran.</p>
      </form>
    </details>
  );
}
