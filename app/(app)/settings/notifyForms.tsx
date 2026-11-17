"use client";
import { useActionState } from "react";
import type { FormState } from "../actions";
import { addTarget, testTarget } from "./notifyActions";
import { Button } from "@/components/ui/Button";
import { FormMessage, SelectField, TextField } from "@/components/ui/Field";
import { CopyText } from "@/components/ui/CopyText";

export function AddTargetForm({ events }: { events: [string, string][] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addTarget, {});
  const f = state.fields;
  const chosen = f?.events?.split(",");
  return (
    <form action={action} className="flex flex-col gap-4 border-b border-border-soft px-5 py-5 sm:px-6">
      <div className="flex flex-wrap items-end gap-3">
        <SelectField label="Type" name="kind" key={`k${f?.kind}`} defaultValue={f?.kind ?? "slack"} className="flex-[0_1_180px]">
          <option value="slack">Slack</option>
          <option value="webhook">Signed webhook</option>
        </SelectField>
        <TextField label="Name" name="name" key={`n${f?.name}`} defaultValue={f?.name} placeholder="#incidents" className="flex-[1_1_160px]" />
        <TextField label="URL" name="url" key={`u${f?.url}`} defaultValue={f?.url} type="url" required autoComplete="off" placeholder="https://hooks.slack.com/services/…" mono className="flex-[3_1_280px]" />
      </div>
      <fieldset className="m-0 flex flex-wrap gap-x-5 gap-y-1 border-0 p-0">
        <legend className="mb-1.5 text-callout font-medium text-fg">Events</legend>
        {events.map(([id, label]) => (
          <label key={id} className="flex min-h-9 cursor-pointer items-center gap-2 text-callout text-fg-2">
            <input type="checkbox" name="events" value={id} key={`${id}${f?.events}`} defaultChecked={chosen ? chosen.includes(id) : id !== "incident.opened" && id !== "check.overridden"} className="h-4 w-4 cursor-pointer accent-signal" />
            {label}
          </label>
        ))}
      </fieldset>
      <div>
        <Button type="submit" disabled={pending}>
          Add target
        </Button>
      </div>
      {state.ok ? (
        <div role="status" className="flex flex-col gap-2 rounded-control border border-border bg-s2 px-3.5 py-3">
          <span className="text-callout font-medium text-fg">{state.ok}</span>
          {state.token && (
            <div className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded-chip bg-sunken px-2 py-1.5 font-mono text-callout text-fg">{state.token}</code>
              <CopyText text={state.token} />
            </div>
          )}
        </div>
      ) : (
        <FormMessage error={state.error} />
      )}
    </form>
  );
}

export function TestTargetButton({ targetId }: { targetId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(testTarget, {});
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="targetId" value={targetId} />
      <Button type="submit" variant="secondary" size="sm" disabled={pending}>
        {pending ? "Sending…" : "Send test"}
      </Button>
      {state.error && (
        <span role="alert" className="text-caption font-medium text-recur">
          {state.error}
        </span>
      )}
      {state.ok && (
        <span role="status" className="text-caption font-medium text-proven">
          {state.ok}
        </span>
      )}
    </form>
  );
}
