"use client";
import { useActionState } from "react";
import { editIncident, type FormState } from "@/app/(app)/actions";
import { TextArea, TextField, FormMessage } from "@/components/ui/Field";
import { buttonClass } from "@/components/ui/Button";
import { ChevronDown } from "@/components/ui/icons";

/** Correct an incident's title and its trigger, observed and expected text. */
export function EditIncident({ id, title, trigger, observed, expected }: { id: string; title: string; trigger: string; observed: string; expected: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(editIncident, {});
  return (
    <details className="group border-t border-border-soft">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-5 text-callout font-medium text-fg-2 hover:text-fg [&::-webkit-details-marker]:hidden">
        Edit details
        <span className="text-fg-3 transition-transform duration-200 ease-fl group-open:rotate-180">
          <ChevronDown size={14} />
        </span>
      </summary>
      <form action={action} className="flex flex-col gap-4 px-5 pb-5" aria-busy={pending}>
        <input type="hidden" name="incidentId" value={id} />
        <TextField label="Title" name="title" defaultValue={title} required maxLength={200} />
        <div className="grid gap-4 md:grid-cols-3">
          <TextArea label="Trigger" name="trigger" defaultValue={trigger} maxLength={4000} className="" />
          <TextArea label="Observed" name="observed" defaultValue={observed} maxLength={4000} className="" />
          <TextArea label="Expected" name="expected" defaultValue={expected} maxLength={4000} className="" />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={pending} aria-busy={pending} className={buttonClass("primary", "sm")}>
            {pending ? "Saving…" : "Save details"}
          </button>
          <FormMessage error={state.error} ok={state.ok} />
        </div>
        <p className="m-0 text-caption text-fg-3">Agents and lessons use the expected behaviour, so keep it specific. Edits don’t change a proof that already ran.</p>
      </form>
    </details>
  );
}
