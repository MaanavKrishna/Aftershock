"use client";
import { useActionState } from "react";
import { createIncident, extractPostmortem, type FormState } from "../../actions";
import { TextField, TextArea, SelectField, FormMessage } from "@/components/ui/Field";
import { buttonClass } from "@/components/ui/Button";
import { Verdict } from "@/components/ui/Verdict";

type Repo = { id: string; name: string };

function Footer({ pending }: { pending: boolean }) {
  return (
    <div className="flex flex-wrap justify-end gap-2 border-t border-border-soft bg-s2/40 px-5 py-3.5">
      <button type="submit" name="intent" value="save" disabled={pending} className={buttonClass("secondary")}>
        Save only
      </button>
      <button type="submit" name="intent" value="travel" disabled={pending} className={buttonClass("primary")}>
        Save and time travel
      </button>
    </div>
  );
}

/** Field errors come back as one message; point it at the field it names so the input is marked invalid. */
function fieldError(error: string | undefined, field: string) {
  return error && error.toLowerCase().includes(field) ? error : undefined;
}

export function IncidentForm({ repos, initial }: { repos: Repo[]; initial?: Record<string, string> }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createIncident, { fields: initial });
  const f = state.fields ?? {};
  const titleError = fieldError(state.error, "title");
  const fixError = fieldError(state.error, "fix") ?? fieldError(state.error, "commit");
  return (
    <form action={action} aria-busy={pending}>
      <input type="hidden" name="source" value={f.source === "postmortem" ? "postmortem" : "form"} />
      <div className="flex flex-col gap-4 p-5">
        {!titleError && !fixError && <FormMessage error={state.error} />}
        <TextField label="Title" name="title" required defaultValue={f.title} error={titleError} placeholder="e.g. Payment retry charged a customer twice" />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Repository" name="repoId" defaultValue={f.repoId} className="">
            {repos.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </SelectField>
          <SelectField label="Severity" name="severity" defaultValue={f.severity ?? "SEV-2"} className="">
            <option value="SEV-1">SEV-1 · customer impact</option>
            <option value="SEV-2">SEV-2 · degraded</option>
            <option value="SEV-3">SEV-3 · minor</option>
          </SelectField>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <TextArea label="Trigger" name="trigger" defaultValue={f.trigger} placeholder="What happened first?" className="" />
          <TextArea label="Observed" name="observed" defaultValue={f.observed} placeholder="What did the system do?" className="" />
          <TextArea label="Expected" name="expected" defaultValue={f.expected} placeholder="What should it have done?" className="" />
        </div>
        <TextField label="Fix commit or pull request" name="fix" mono defaultValue={f.fix} error={fixError} hint="A SHA, PR number or GitHub URL. Leave it empty if it isn’t fixed yet." placeholder="3d8fb01 or #44" />
      </div>
      <Footer pending={pending} />
    </form>
  );
}

export function PostmortemForm({ repos }: { repos: Repo[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(extractPostmortem, {});
  return (
    <div>
      <form action={action} className="flex flex-col gap-4 p-5" aria-busy={pending}>
        <TextArea
          label="Paste the postmortem"
          name="postmortem"
          rows={9}
          defaultValue={state.fields?.postmortem}
          error={state.error}
          placeholder="Markdown, plain text or a doc export. Summary, timeline, root cause, fix: whatever you have."
          className=""
        />
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={pending} aria-busy={pending} className={buttonClass("primary")}>
            {pending ? "Extracting…" : "Extract incident"}
          </button>
          <span className="text-caption text-fg-3">The model drafts the fields; you check them before saving.</span>
        </div>
      </form>
      {state.ok && state.fields && (
        <div className="mx-5 mb-5 overflow-hidden rounded-card border border-dashed border-border-strong">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4">
            <span className="font-medium text-fg">{state.ok}</span>
            <Verdict kind="drafted" size="sm" />
          </div>
          <IncidentForm repos={repos} initial={state.fields} />
        </div>
      )}
    </div>
  );
}
