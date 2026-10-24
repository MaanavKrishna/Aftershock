"use client";
import { useActionState } from "react";
import type { FormState } from "../actions";
import { rotateSecret, saveMapping, saveSecret, testDelivery, saveModel, testModel } from "./actions";

const btn = "min-h-[42px] cursor-pointer rounded-[9px] px-4 text-[13.5px] font-semibold";
function Status({ s }: { s: FormState }) {
  if (s.error) return <p role="alert" className="m-0 text-[13px] text-fail-deep">{s.error}</p>;
  if (s.ok) return <p role="status" className="m-0 flex flex-col gap-1 text-[13px] text-pass">{s.ok}{s.token && <code className="break-all rounded-md bg-pass-wash px-2 py-1.5 font-mono text-[12.5px] text-ink">{s.token}</code>}</p>;
  return null;
}

type AlertProps = { kind: string; label: string; auth: "signature" | "token"; secretFrom: "provider" | "aftershock"; mappingLabel: string; placeholder: string; mapping: string };

export function AlertForms({ kind, label, auth, secretFrom, mappingLabel, placeholder, mapping }: AlertProps) {
  const [m, saveM, p1] = useActionState<FormState, FormData>(saveMapping, {});
  const [r, rotate, p2] = useActionState<FormState, FormData>(rotateSecret, {});
  const [k, keep, p4] = useActionState<FormState, FormData>(saveSecret, {});
  const [t, test, p3] = useActionState<FormState, FormData>(testDelivery, {});
  const input = "min-h-[44px] rounded-[9px] border border-field px-3 font-mono text-[13px] font-normal";
  return (
    <div className="flex flex-col gap-4 border-t border-line-soft pt-4">
      <form action={saveM} className="flex flex-col gap-2">
        <input type="hidden" name="kind" value={kind} />
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold">{mappingLabel}<input name="mapping" defaultValue={mapping} placeholder={placeholder} className={input} /></label>
        <div className="flex items-center gap-3"><button type="submit" disabled={p1} className={`${btn} bg-ink text-paper`}>Save mapping</button><Status s={m} /></div>
      </form>
      {secretFrom === "provider" && (
        <form action={keep} className="flex flex-col gap-2">
          <input type="hidden" name="kind" value={kind} />
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Signing secret from {label}<input name="secret" type="password" autoComplete="off" spellCheck={false} placeholder="Paste the secret" className={input} /></label>
          <div className="flex items-center gap-3"><button type="submit" disabled={p4} className={`${btn} border border-line-strong bg-card`}>Save signing secret</button><Status s={k} /></div>
        </form>
      )}
      <div className="flex flex-wrap items-start gap-3">
        {secretFrom === "aftershock" && <form action={rotate}><input type="hidden" name="kind" value={kind} /><button type="submit" disabled={p2} className={`${btn} border border-line-strong bg-card`}>{auth === "token" ? "Generate token" : "Generate signing secret"}</button></form>}
        <form action={test}><input type="hidden" name="kind" value={kind} /><button type="submit" disabled={p3} className={`${btn} border border-line-strong bg-card`}>Send test delivery</button></form>
      </div>
      <Status s={r} />
      <Status s={t} />
    </div>
  );
}

export function ModelForm({ provider, model, baseUrl }: { provider: string; model: string; baseUrl: string }) {
  const [s, save, p1] = useActionState<FormState, FormData>(saveModel, {});
  const [t, test, p2] = useActionState<FormState, FormData>(async () => testModel(), {});
  const input = "min-h-[44px] rounded-[9px] border border-field px-3 font-mono text-[13px] font-normal";
  return (
    <div className="flex flex-col gap-4 border-t border-line-soft pt-4">
      <form action={save} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Provider<select name="provider" defaultValue={provider} className={`${input} font-sans`}><option value="muse">Muse (server key)</option><option value="gateway">Vercel AI Gateway</option><option value="custom">Custom OpenAI-compatible endpoint</option></select></label>
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-[1_1_200px] flex-col gap-1.5 text-[13px] font-semibold">Model<input name="model" defaultValue={model} placeholder="model name" className={input} /></label>
          <label className="flex flex-[2_1_260px] flex-col gap-1.5 text-[13px] font-semibold">Base URL (custom only)<input name="baseUrl" defaultValue={baseUrl} placeholder="https://your-endpoint/v1" className={input} /></label>
        </div>
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold">API key<input name="apiKey" type="password" autoComplete="off" placeholder="Leave empty to keep the current key" className={`${input} font-sans`} /></label>
        <div className="flex items-center gap-3"><button type="submit" disabled={p1} className={`${btn} bg-ink text-paper`}>Save model</button><Status s={s} /></div>
      </form>
      <form action={test} className="flex items-center gap-3"><button type="submit" disabled={p2} className={`${btn} border border-line-strong bg-card`}>{p2 ? "Testing…" : "Test connection"}</button><Status s={t} /></form>
    </div>
  );
}
