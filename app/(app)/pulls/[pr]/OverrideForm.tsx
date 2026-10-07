"use client";
import { useActionState } from "react";
import { overrideCheck, type FormState } from "../../actions";

export function OverrideForm({ checkId }: { checkId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(overrideCheck, {});
  return (
    <details className="group">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-center rounded-[9px] border border-[#344150] font-semibold text-on-dark">Override with a reason</summary>
      <form action={action} className="mt-3 flex flex-col gap-2">
        <input type="hidden" name="checkId" value={checkId} />
        <label className="flex flex-col gap-1.5 text-[12.5px] text-[#C9D1DA]">Reason<textarea name="reason" rows={2} required minLength={10} className="resize-y rounded-[9px] border border-[#344150] bg-ink-2 px-3 py-2.5 text-on-dark" /></label>
        {state.error && <p role="alert" className="m-0 text-[12.5px] text-fail-dark">{state.error}</p>}
        {state.ok && <p role="status" className="m-0 text-[12.5px] text-pass-dark">{state.ok}</p>}
        <button type="submit" disabled={pending} className="min-h-10 cursor-pointer rounded-[9px] bg-paper font-semibold text-ink">Record override</button>
      </form>
    </details>
  );
}
