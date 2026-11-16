"use client";
import { useActionState } from "react";
import type { FormState } from "../actions";
import { rotateSecret, saveMapping, saveSecret, testDelivery, saveModel, testModel } from "./actions";
import { Button } from "@/components/ui/Button";
import { FormMessage, TextField } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Tabs";
import { CopyText } from "@/components/ui/CopyText";

/** A form result; a freshly generated secret is shown once, with a copy button. */
function Status({ s }: { s: FormState }) {
  if (s.ok && s.token)
    return (
      <div role="status" className="flex flex-col gap-2 rounded-control border border-border bg-s2 px-3.5 py-3">
        <span className="text-callout font-medium text-fg">{s.ok}</span>
        <div className="flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 break-all rounded-chip bg-sunken px-2 py-1.5 font-mono text-callout text-fg">{s.token}</code>
          <CopyText text={s.token} />
        </div>
      </div>
    );
  return <FormMessage error={s.error} ok={s.ok} />;
}

type AlertProps = { kind: string; label: string; auth: "signature" | "token"; secretFrom: "provider" | "aftershock"; mappingLabel: string; placeholder: string; mapping: string };

export function AlertForms({ kind, label, auth, secretFrom, mappingLabel, placeholder, mapping }: AlertProps) {
  const [m, saveM, p1] = useActionState<FormState, FormData>(saveMapping, {});
  const [r, rotate, p2] = useActionState<FormState, FormData>(rotateSecret, {});
  const [k, keep, p4] = useActionState<FormState, FormData>(saveSecret, {});
  const [t, test, p3] = useActionState<FormState, FormData>(testDelivery, {});
  return (
    <div className="flex flex-col gap-5">
      <form action={saveM} className="flex flex-col gap-3">
        <input type="hidden" name="kind" value={kind} />
        <TextField label={mappingLabel} name="mapping" defaultValue={mapping} placeholder={placeholder} mono error={m.error} />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={p1}>
            Save mapping
          </Button>
          <FormMessage ok={m.ok} />
        </div>
      </form>
      {secretFrom === "provider" && (
        <form action={keep} className="flex flex-col gap-3 border-t border-border-soft pt-5">
          <input type="hidden" name="kind" value={kind} />
          <TextField label={`Signing secret from ${label}`} name="secret" type="password" autoComplete="off" spellCheck={false} placeholder="Paste the secret" mono error={k.error} />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="secondary" disabled={p4}>
              Save signing secret
            </Button>
            <FormMessage ok={k.ok} />
          </div>
        </form>
      )}
      <div className="flex flex-col gap-3 border-t border-border-soft pt-5">
        <div className="flex flex-wrap items-start gap-2">
          {secretFrom === "aftershock" && (
            <form action={rotate}>
              <input type="hidden" name="kind" value={kind} />
              <Button type="submit" variant="secondary" disabled={p2}>
                {auth === "token" ? "Generate token" : "Generate signing secret"}
              </Button>
            </form>
          )}
          <form action={test}>
            <input type="hidden" name="kind" value={kind} />
            <Button type="submit" variant="secondary" disabled={p3}>
              {p3 ? "Sending…" : "Send test delivery"}
            </Button>
          </form>
        </div>
        <Status s={r} />
        <Status s={t} />
      </div>
    </div>
  );
}

export function ModelForm({ provider, model, baseUrl }: { provider: string; model: string; baseUrl: string }) {
  const [s, save, p1] = useActionState<FormState, FormData>(saveModel, {});
  const [t, test, p2] = useActionState<FormState, FormData>(async () => testModel(), {});
  return (
    <div className="flex flex-col gap-5">
      <form action={save} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-callout font-medium text-fg" aria-hidden="true">
            Provider
          </span>
          <Segmented
            name="provider"
            label="Provider"
            value={provider}
            options={[
              { value: "muse", label: "Muse" },
              { value: "gateway", label: "AI Gateway" },
              { value: "custom", label: "Custom" },
            ]}
          />
          <span className="text-caption text-fg-3">Muse uses the server key. AI Gateway takes one key for many models. Custom is any OpenAI-compatible endpoint.</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
          <TextField label="Model" name="model" defaultValue={model} placeholder="model name" mono />
          <TextField label="Base URL (custom only)" name="baseUrl" defaultValue={baseUrl} placeholder="https://your-endpoint/v1" mono />
        </div>
        <TextField label="API key" name="apiKey" type="password" autoComplete="off" placeholder="Leave empty to keep the current key" hint="Encrypted at rest. Never sent to a sandbox." />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={p1}>
            Save model
          </Button>
          <FormMessage error={s.error} ok={s.ok} />
        </div>
      </form>
      <form action={test} className="flex flex-wrap items-center gap-3 border-t border-border-soft pt-5">
        <Button type="submit" variant="secondary" disabled={p2}>
          {p2 ? "Testing…" : "Test connection"}
        </Button>
        <FormMessage error={t.error} ok={t.ok} />
      </form>
    </div>
  );
}
