"use client";
import { useActionState } from "react";
import { saveWorkspace, createToken, type FormState } from "../actions";

export function WorkspaceForm({ name, prefix, label, autoImport, autoTravel }: { name: string; prefix: string; label: string; autoImport: boolean; autoTravel: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveWorkspace, {});
  const input = "min-h-[46px] rounded-[9px] border border-field px-3 font-normal";
  return (
    <form action={action}>
      <div className="flex flex-col gap-[18px] px-6 py-[22px]">
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Display name<input name="name" defaultValue={name} className={input} /></label>
        <div className="flex flex-wrap gap-3.5">
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Incident ID prefix<input name="prefix" defaultValue={prefix} className={`${input} max-w-[160px] font-mono`} /></label>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Issue label<input name="label" defaultValue={label} className={`${input} max-w-[200px] font-mono`} /></label>
        </div>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 font-semibold"><input type="checkbox" name="autoImport" defaultChecked={autoImport} className="h-[18px] w-[18px] accent-ink" />Auto-import closed issues with the label</label>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 font-semibold"><input type="checkbox" name="autoTravel" defaultChecked={autoTravel} className="h-[18px] w-[18px] accent-ink" />Start time travel when a fix PR referencing an incident merges</label>
        {state.error && <p role="alert" className="m-0 text-[13px] text-fail-deep">{state.error}</p>}
        {state.ok && <p role="status" className="m-0 text-[13px] text-pass">{state.ok}</p>}
      </div>
      <div className="flex justify-end rounded-b-[14px] border-t border-[#EDEEE9] bg-[#FAFAF8] px-6 py-3.5"><button type="submit" disabled={pending} className="min-h-[42px] cursor-pointer rounded-[9px] bg-ink px-[18px] font-semibold text-white">Save</button></div>
    </form>
  );
}

export function TokenForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createToken, {});
  return (
    <form action={action} className="flex flex-col gap-3 border-b border-[#EDEEE9] px-6 py-[18px]">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-[1_1_220px] flex-col gap-1.5 text-[13px] font-semibold">Token name<input name="name" placeholder="e.g. GitHub Action · storefront-web" className="min-h-[42px] rounded-[9px] border border-field px-3 font-normal" /></label>
        <button type="submit" disabled={pending} className="min-h-[42px] cursor-pointer rounded-[9px] bg-ink px-4 font-semibold text-white">Create token</button>
      </div>
      {state.token && (
        <div role="status" className="flex flex-col gap-1.5 rounded-[10px] bg-pass-wash px-3.5 py-3 text-[13px] text-pass-deep">
          <span className="font-semibold">{state.ok}</span>
          <code className="break-all font-mono text-[12.5px] text-ink">{state.token}</code>
        </div>
      )}
    </form>
  );
}
