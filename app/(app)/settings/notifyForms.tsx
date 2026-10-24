"use client";
import { useActionState } from "react";
import type { FormState } from "../actions";
import { addTarget, testTarget } from "./notifyActions";

const input = "min-h-[42px] rounded-[9px] border border-field px-3 font-normal";

export function AddTargetForm({ events }: { events: [string, string][] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addTarget, {});
  const f = state.fields;
  const chosen = f?.events?.split(",");
  return (
    <form action={action} className="flex flex-col gap-3 border-b border-[#EDEEE9] px-6 py-[18px]">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-[0_1_160px] flex-col gap-1.5 text-[13px] font-semibold">Type<select name="kind" key={`k${f?.kind}`} defaultValue={f?.kind ?? "slack"} className={`${input} font-sans`}><option value="slack">Slack</option><option value="webhook">Signed webhook</option></select></label>
        <label className="flex flex-[1_1_160px] flex-col gap-1.5 text-[13px] font-semibold">Name<input name="name" key={`n${f?.name}`} defaultValue={f?.name} placeholder="#incidents" className={input} /></label>
        <label className="flex flex-[3_1_280px] flex-col gap-1.5 text-[13px] font-semibold">URL<input name="url" key={`u${f?.url}`} defaultValue={f?.url} type="url" required autoComplete="off" placeholder="https://hooks.slack.com/services/…" className={`${input} font-mono text-[13px]`} /></label>
      </div>
      <fieldset className="m-0 flex flex-wrap gap-x-5 gap-y-1 border-0 p-0">
        <legend className="mb-1 text-[13px] font-semibold">Events</legend>
        {events.map(([id, label]) => (
          <label key={id} className="flex min-h-9 cursor-pointer items-center gap-2 text-[13px]"><input type="checkbox" name="events" value={id} key={`${id}${f?.events}`} defaultChecked={chosen ? chosen.includes(id) : id !== "incident.opened" && id !== "check.overridden"} className="h-4 w-4 accent-ink" />{label}</label>
        ))}
      </fieldset>
      <div className="flex items-center gap-3"><button type="submit" disabled={pending} className="min-h-[42px] cursor-pointer rounded-[9px] bg-ink px-4 font-semibold text-white">Add target</button></div>
      {state.error && <p role="alert" className="m-0 text-[13px] text-fail-deep">{state.error}</p>}
      {state.ok && (
        <div role="status" className="flex flex-col gap-1.5 rounded-[10px] bg-pass-wash px-3.5 py-3 text-[13px] text-pass-deep">
          <span className="font-semibold">{state.ok}</span>
          {state.token && <code className="break-all font-mono text-[12.5px] text-ink">{state.token}</code>}
        </div>
      )}
    </form>
  );
}

export function TestTargetButton({ targetId }: { targetId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(testTarget, {});
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="targetId" value={targetId} />
      <button type="submit" disabled={pending} className="min-h-[38px] cursor-pointer rounded-lg border border-line-strong bg-white px-3 font-semibold">{pending ? "Sending…" : "Send test"}</button>
      {state.error && <span role="alert" className="text-[12.5px] text-fail-deep">{state.error}</span>}
      {state.ok && <span role="status" className="text-[12.5px] text-pass">{state.ok}</span>}
    </form>
  );
}
