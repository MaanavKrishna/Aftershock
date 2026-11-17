"use client";
import { useActionState } from "react";
import { overrideCheck, type FormState } from "../../actions";
import { TextArea, FormMessage } from "@/components/ui/Field";
import { buttonClass } from "@/components/ui/Button";
import { ChevronDown } from "@/components/ui/icons";

/** Override a blocking verdict. A reason is required and recorded on the incident trail. */
export function OverrideForm({ checkId }: { checkId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(overrideCheck, {});
  return (
    <details className="group">
      <summary className={buttonClass("secondary", "sm", "w-full list-none [&::-webkit-details-marker]:hidden")}>
        Override with a reason
        <span className="text-fg-3 transition-transform duration-200 ease-fl group-open:rotate-180">
          <ChevronDown size={14} />
        </span>
      </summary>
      <form action={action} className="mt-3 flex flex-col gap-3" aria-busy={pending}>
        <input type="hidden" name="checkId" value={checkId} />
        <TextArea label="Reason" name="reason" rows={2} required minLength={10} error={state.error} hint="At least 10 characters. Everyone on the incident sees it." className="" />
        <FormMessage ok={state.ok} />
        <button type="submit" disabled={pending} className={buttonClass("danger", "sm")}>
          {pending ? "Recording…" : "Record override"}
        </button>
      </form>
    </details>
  );
}
