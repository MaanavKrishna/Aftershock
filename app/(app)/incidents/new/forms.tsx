"use client";
import { useActionState } from "react";
import { createIncident, extractPostmortem, type FormState } from "../../actions";
import { TextField, TextArea, SelectField } from "@/components/ui/Field";

type Repo = { id: string; name: string };

function Footer() {
  return (
    <div className="flex flex-wrap justify-end gap-2.5 rounded-b-[14px] border-t border-[#EDEEE9] bg-[#FAFAF8] px-6 py-4">
      <button type="submit" name="intent" value="save" className="inline-flex min-h-11 cursor-pointer items-center rounded-[9px] border border-line-strong bg-white px-4 font-semibold">Save only</button>
      <button type="submit" name="intent" value="travel" className="inline-flex min-h-11 cursor-pointer items-center rounded-[9px] bg-ink px-[18px] font-semibold text-white">Save and time travel</button>
    </div>
  );
}

export function IncidentForm({ repos, initial }: { repos: Repo[]; initial?: Record<string, string> }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createIncident, { fields: initial });
  const f = state.fields ?? {};
  return (
    <form action={action} aria-busy={pending}>
      <div className="flex flex-col gap-4 p-6">
        {state.error && <p role="alert" className="m-0 rounded-[10px] bg-fail-tint px-4 py-3 text-[13.5px] text-fail-ink">{state.error}</p>}
        <TextField label="Title" name="title" required defaultValue={f.title} placeholder="e.g. Payment retry charged a customer twice" />
        <div className="flex flex-wrap gap-3.5">
          <SelectField label="Repository" name="repoId" defaultValue={f.repoId}>
            {repos.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </SelectField>
          <SelectField label="Severity" name="severity" defaultValue={f.severity ?? "SEV-2"}>
            <option value="SEV-1">SEV-1 · customer impact</option>
            <option value="SEV-2">SEV-2 · degraded</option>
            <option value="SEV-3">SEV-3 · minor</option>
          </SelectField>
        </div>
        <div className="flex flex-wrap gap-3.5">
          <TextArea label="Trigger" name="trigger" defaultValue={f.trigger} placeholder="What happened first?" />
          <TextArea label="Observed" name="observed" defaultValue={f.observed} placeholder="What did the system do?" />
          <TextArea label="Expected" name="expected" defaultValue={f.expected} placeholder="What should it have done?" />
        </div>
        <TextField label="Fix commit or pull request" name="fix" mono defaultValue={f.fix} placeholder="SHA, PR number or URL — leave empty if not fixed yet" />
      </div>
      <Footer />
    </form>
  );
}

export function PostmortemForm({ repos }: { repos: Repo[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(extractPostmortem, {});
  return (
    <div>
      <form action={action} className="flex flex-col gap-4 p-6" aria-busy={pending}>
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
          Paste the postmortem
          <textarea name="postmortem" rows={9} defaultValue={state.fields?.postmortem} placeholder="Markdown, plain text or a doc export. Summary, timeline, root cause, fix — whatever you have." className="resize-y rounded-[9px] border border-field p-3 font-normal" />
        </label>
        <div className="flex flex-wrap items-center gap-2.5">
          <button type="submit" disabled={pending} className="min-h-[42px] cursor-pointer rounded-[9px] bg-ink px-4 font-semibold text-white">{pending ? "Extracting…" : "Extract incident"}</button>
          <span className="text-[12.5px] text-muted">The model drafts the fields; you check them before saving.</span>
        </div>
        {state.error && <p role="alert" className="m-0 rounded-[10px] bg-fail-tint px-4 py-3 text-[13.5px] text-fail-ink">{state.error}</p>}
      </form>
      {state.ok && state.fields && (
        <div className="mx-6 mb-6 rounded-xl border-[1.5px] border-dashed border-[#9AA1A9]">
          <div className="flex flex-wrap justify-between gap-2 px-[18px] pt-4"><span className="font-semibold">{state.ok}</span><span className="rounded-[5px] border border-dashed border-muted-2 px-2 py-0.5 text-[11px] font-semibold text-body">AI draft</span></div>
          <IncidentForm repos={repos} initial={state.fields} />
        </div>
      )}
    </div>
  );
}
