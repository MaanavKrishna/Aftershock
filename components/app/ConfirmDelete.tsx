"use client";
import { useActionState, useId, useState } from "react";
import type { FormState } from "@/app/(app)/actions";
import { Button } from "@/components/ui/Button";
import { FormMessage, inputClass } from "@/components/ui/Field";

/** A destructive action behind a disclosure and a typed confirmation. */
export function ConfirmDelete({
  action,
  fields,
  expected,
  button,
  description,
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  fields: Record<string, string>;
  expected: string;
  button: string;
  description: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, {});
  const id = useId();
  if (!open) {
    return (
      <Button variant="dangerOutline" onClick={() => setOpen(true)}>
        {button}
      </Button>
    );
  }
  return (
    <form action={formAction} className="flex w-full animate-[fl-in_200ms_var(--ease-fl)] flex-col gap-3 rounded-control border border-recur-line bg-recur-soft p-4" aria-busy={pending}>
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <p id={`${id}-desc`} className="m-0 text-callout text-fg-2">
        {description}
      </p>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="text-callout font-medium text-fg">
          Type <span className="font-mono font-semibold">{expected}</span> to confirm
        </label>
        <input
          id={id}
          name="confirm"
          autoComplete="off"
          spellCheck={false}
          required
          autoFocus
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? `${id}-error ${id}-desc` : `${id}-desc`}
          className={`${inputClass} font-mono`}
        />
      </div>
      {state.error && (
        <p id={`${id}-error`} role="alert" className="m-0 text-callout font-medium text-recur">
          {state.error}
        </p>
      )}
      <FormMessage ok={state.ok} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="danger" disabled={pending}>
          {pending ? "Deleting…" : "Delete permanently"}
        </Button>
        <Button variant="secondary" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
