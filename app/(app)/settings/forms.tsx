"use client";
import { useActionState } from "react";
import { saveWorkspace, createToken, type FormState } from "../actions";
import { Button } from "@/components/ui/Button";
import { FormMessage, SelectField, TextField } from "@/components/ui/Field";
import { CopyText } from "@/components/ui/CopyText";

function Check({ name, checked, label, hint }: { name: string; checked: boolean; label: string; hint: string }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 py-1">
      <input type="checkbox" name={name} defaultChecked={checked} className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-signal" />
      <span className="flex flex-col gap-0.5">
        <span className="text-ui font-medium text-fg">{label}</span>
        <span className="text-callout text-fg-3">{hint}</span>
      </span>
    </label>
  );
}

export function WorkspaceForm({ name, prefix, label, autoImport, autoTravel }: { name: string; prefix: string; label: string; autoImport: boolean; autoTravel: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveWorkspace, {});
  return (
    <form action={action}>
      <div className="flex flex-col gap-5 px-5 py-5 sm:px-6">
        <TextField label="Display name" name="name" defaultValue={name} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Incident ID prefix" name="prefix" defaultValue={prefix} mono hint="Incidents are numbered like INC-12." />
          <TextField label="Issue label" name="label" defaultValue={label} mono hint="Closed GitHub issues with this label become incidents." />
        </div>
        <fieldset className="m-0 flex flex-col gap-1 border-0 p-0">
          <legend className="mb-1 text-callout font-medium text-fg">Automation</legend>
          <Check name="autoImport" checked={autoImport} label="Auto-import closed issues with the label" hint="New incidents appear as soon as the issue closes." />
          <Check name="autoTravel" checked={autoTravel} label="Start time travel when a fix PR referencing an incident merges" hint="The test is proven against the fix without anyone pressing a button." />
        </fieldset>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border-soft bg-s2 px-5 py-3 sm:px-6">
        <FormMessage error={state.error} ok={state.ok} />
        <Button type="submit" disabled={pending}>
          Save
        </Button>
      </div>
    </form>
  );
}

export function TokenForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createToken, {});
  return (
    <form action={action} className="flex flex-col gap-3 border-b border-border-soft px-5 py-5 sm:px-6">
      <div className="flex flex-wrap items-end gap-3">
        <TextField label="Token name" name="name" placeholder="e.g. GitHub Action · storefront-web" className="flex-[1_1_220px]" />
        <SelectField label="Access" name="scope" defaultValue="read" className="flex-[1_1_200px]">
          <option value="read">Read only (MCP, badges, exports)</option>
          <option value="write">Read and write (CI, Actions)</option>
        </SelectField>
        <Button type="submit" disabled={pending}>
          Create token
        </Button>
      </div>
      {state.token ? (
        <div role="status" className="flex flex-col gap-2 rounded-control border border-border bg-s2 px-3.5 py-3">
          <span className="text-callout font-medium text-fg">{state.ok}</span>
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-chip bg-sunken px-2 py-1.5 font-mono text-callout text-fg">{state.token}</code>
            <CopyText text={state.token} />
          </div>
        </div>
      ) : (
        <FormMessage error={state.error} />
      )}
    </form>
  );
}
