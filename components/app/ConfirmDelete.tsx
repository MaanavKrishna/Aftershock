"use client";
import { useActionState, useId, useState } from "react";
import type { FormState } from "@/app/(app)/actions";

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
      <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-[42px] cursor-pointer items-center rounded-[9px] border border-fail-line bg-card px-4 font-semibold text-fail-deep">
        {button}
      </button>
    );
  }
  return (
    <form action={formAction} className="flex w-full flex-col gap-3 rounded-[12px] border border-fail-line bg-fail-tint/40 p-4" aria-busy={pending}>
      {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <p className="m-0 text-[13px] text-body">{description}</p>
      <label htmlFor={id} className="flex flex-col gap-1.5 text-[13px] font-semibold">
        Type <span className="font-mono">{expected}</span> to confirm
        <input id={id} name="confirm" autoComplete="off" required className="min-h-[42px] rounded-[9px] border border-field px-3 font-mono font-normal" />
      </label>
      {state.error && <p role="alert" className="m-0 text-[13px] text-fail-deep">{state.error}</p>}
      {state.ok && <p role="status" className="m-0 text-[13px] text-pass-deep">{state.ok}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className="inline-flex min-h-[42px] cursor-pointer items-center rounded-[9px] bg-fail px-4 font-semibold text-on-accent disabled:opacity-70">
          {pending ? "Deleting…" : "Delete permanently"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="inline-flex min-h-[42px] cursor-pointer items-center rounded-[9px] border border-line-strong bg-card px-4 font-semibold">
          Cancel
        </button>
      </div>
    </form>
  );
}
