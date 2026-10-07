"use client";
import { useState } from "react";
import Link from "next/link";
import { finishOnboarding } from "../actions";

type Repo = { id: string; name: string; meta: string; framework: string; supported: boolean; install: string };
const STEPS = [["repos", "Repositories", "Where incidents live"], ["runner", "Runner", "Sandbox or your Actions"], ["model", "Model", "Who drafts the tests"], ["incident", "First incident", "Import and prove one"]] as const;

export function Wizard({ repos, installUrl }: { repos: Repo[]; installUrl: string | null }) {
  const [step, setStep] = useState(0);
  const [runner, setRunner] = useState<"sandbox" | "actions">("sandbox");
  const [provider, setProvider] = useState<"muse" | "gateway" | "custom">("muse");
  const card = (on: boolean) => `flex w-full cursor-pointer gap-3.5 rounded-xl bg-white text-left text-ink ${on ? "border-2 border-ink" : "border border-line"}`;
  return (
    <form action={finishOnboarding} className="flex flex-wrap items-start gap-10">
      <ol aria-label="Setup steps" className="m-0 flex max-w-full flex-[1_1_260px] list-none flex-col gap-1 p-0">
        {STEPS.map(([id, label, sub], i) => (
          <li key={id}>
            <button type="button" onClick={() => setStep(i)} aria-current={i === step ? "step" : undefined} className={`flex w-full cursor-pointer items-center gap-3.5 rounded-[10px] border-0 px-3.5 py-3 text-left ${i === step ? "bg-white shadow-[0_1px_2px_rgba(14,20,27,0.08),inset_0_0_0_1px_#E2E3DD]" : "bg-transparent"}`}>
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-[12.5px] font-semibold ${i < step ? "bg-pass text-white" : i === step ? "bg-ink text-white" : "border-[1.5px] border-field text-muted"}`}>{i < step ? "✓" : i + 1}</span>
              <span className="flex flex-col"><span className="font-semibold">{label}</span><span className="text-[12.5px] text-muted">{sub}</span></span>
            </button>
          </li>
        ))}
      </ol>
      <section className="flex min-w-0 flex-[999_1_560px] flex-col rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(14,20,27,0.04)]">
        <input type="hidden" name="runner" value={runner} />
        <input type="hidden" name="provider" value={provider} />
        <div className={step === 0 ? "flex flex-col gap-[22px] p-8 max-sm:p-5" : "hidden"}>
          <div className="flex flex-col gap-1.5"><h1 className="m-0 text-[26px] font-semibold tracking-[-0.025em]">Choose repositories</h1><p className="m-0 text-muted">Pick where Aftershock should remember incidents. You can change this later.</p></div>
          {repos.length === 0 ? (
            <p className="m-0 rounded-xl border border-line p-5 text-muted">No repositories yet. {installUrl ? <a href={installUrl} className="text-pass">Install the GitHub App</a> : "Configure the GitHub App (GITHUB_APP_SLUG) to install it"} on the repositories you want to protect.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-line">
              {repos.map((r) => (
                <label key={r.id} className="flex min-h-11 cursor-pointer items-center gap-3.5 border-b border-line-soft px-[18px] py-3.5">
                  <input type="checkbox" name="repo" value={r.id} defaultChecked={r.supported} disabled={!r.supported} className="h-[18px] w-[18px] accent-ink" />
                  <span className="flex min-w-0 flex-1 flex-col"><span className="font-mono font-semibold">{r.name}</span><span className="text-[12.5px] text-muted">{r.meta}</span></span>
                  <span className={`rounded-[5px] px-2 py-0.5 font-mono text-[11.5px] font-semibold ${r.framework === "pytest" ? "bg-pass-tint text-pass-deep" : "bg-fail-tint text-fail-ink"}`}>{r.framework}</span>
                </label>
              ))}
            </div>
          )}
          <div className="flex gap-3 rounded-[10px] bg-pass-wash px-4 py-3.5 text-[13px] text-pass-deep"><span className="font-semibold">Permissions.</span><span>Runners get read-only clone tokens. The app writes only to aftershock/* branches to open test PRs — never to your default branch.</span></div>
        </div>
        <div className={step === 1 ? "flex flex-col gap-[22px] p-8 max-sm:p-5" : "hidden"}>
          <div className="flex flex-col gap-1.5"><h2 className="m-0 text-[26px] font-semibold tracking-[-0.025em]">Where should checks run?</h2><p className="m-0 text-muted">Time travel always uses the sandbox. Pull request checks can run there or on your runners.</p></div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] gap-2.5">
            {([["sandbox", "Aftershock sandbox", "No setup", "Fresh microVM per run, no secrets. Uses your sandbox CPU-hours; falls back to Actions when they run out."], ["actions", "Your GitHub Actions", "Unlimited", "Add one workflow file. Runs on your runners with your services; results report to the same check."]] as const).map(([id, name, tag, text]) => (
              <button key={id} type="button" onClick={() => setRunner(id)} aria-pressed={runner === id} className={`${card(runner === id)} min-h-[120px] flex-col p-[18px]`}>
                <span className="flex w-full items-center justify-between gap-2"><span className="text-[15px] font-semibold">{name}</span><span className={`rounded-[5px] px-2 py-0.5 text-[11px] font-semibold ${id === "sandbox" ? "bg-pass-tint text-pass-deep" : "border border-dashed border-muted-2 text-body"}`}>{tag}</span></span>
                <span className="text-[13px] text-muted">{text}</span>
              </button>
            ))}
          </div>
          {repos.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-line">
              <div className="border-b border-[#EDEEE9] bg-[#FAFAF8] px-[18px] py-2.5 text-xs text-muted-2">Detected in your repositories</div>
              {repos.filter((r) => r.supported).map((r) => <div key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line-soft px-[18px] py-[13px]"><span className="flex-[1_1_180px] font-mono font-semibold">{r.name}</span><span className="font-mono text-[12.5px] text-body">{r.framework}</span><span className="text-[12.5px] text-muted">{r.install}</span></div>)}
            </div>
          )}
        </div>
        <div className={step === 2 ? "flex flex-col gap-[22px] p-8 max-sm:p-5" : "hidden"}>
          <div className="flex flex-col gap-1.5"><h2 className="m-0 text-[26px] font-semibold tracking-[-0.025em]">Pick the model that drafts tests</h2><p className="m-0 text-muted">It only drafts. Time travel decides. Any OpenAI-compatible endpoint works.</p></div>
          <div role="radiogroup" aria-label="Model provider" className="flex flex-col gap-2">
            {([["muse", "Muse Spark (default)", "Uses the server’s configured key. Nothing to set up.", "ready"], ["gateway", "Vercel AI Gateway", "Choose any supported model by name with one key.", "model id"], ["custom", "Custom OpenAI-compatible endpoint", "Self-hosted or another provider. Bring the URL and key.", "URL + key"]] as const).map(([id, name, text, note]) => (
              <button key={id} type="button" role="radio" aria-checked={provider === id} onClick={() => setProvider(id)} className={`${card(provider === id)} min-h-16 items-center px-4 py-3`}>
                <span className={`box-border h-[18px] w-[18px] shrink-0 rounded-full ${provider === id ? "border-[6px] border-ink" : "border-[1.5px] border-[#9AA1A9]"}`} />
                <span className="flex min-w-0 flex-1 flex-col"><span className="font-semibold">{name}</span><span className="text-[12.5px] text-muted">{text}</span></span>
                <span className="font-mono text-xs text-muted">{note}</span>
              </button>
            ))}
          </div>
          {provider !== "muse" && (
            <div className="flex flex-wrap gap-3.5">
              {provider === "custom" && <label className="flex flex-[2_1_280px] flex-col gap-1.5 text-[13px] font-semibold">Base URL<input name="baseUrl" type="url" placeholder="https://your-endpoint/v1" className="min-h-[46px] rounded-[9px] border border-field px-3 font-mono text-[13px] font-normal" /></label>}
              <label className="flex flex-[1_1_180px] flex-col gap-1.5 text-[13px] font-semibold">Model<input name="model" placeholder={provider === "gateway" ? "provider/model-name" : "model-name"} className="min-h-[46px] rounded-[9px] border border-field px-3 font-mono text-[13px] font-normal" /></label>
              <label className="flex flex-[1_1_100%] flex-col gap-1.5 text-[13px] font-semibold">API key<input name="apiKey" type="password" autoComplete="off" placeholder="Stored encrypted. Never shown again." className="min-h-[46px] rounded-[9px] border border-field px-3 font-normal" /></label>
            </div>
          )}
        </div>
        <div className={step === 3 ? "flex flex-col gap-5 p-8 max-sm:p-5" : "hidden"}>
          <div className="flex flex-col gap-1.5"><h2 className="m-0 text-[26px] font-semibold tracking-[-0.025em]">Import your first incident</h2><p className="m-0 text-muted">Finish setup to see closed issues labelled <span className="rounded-[5px] bg-fail-tint px-1.5 font-mono text-[13px] text-fail-ink">incident</span> with a linked fix. Pick one and watch it time travel.</p></div>
          <p className="m-0 text-[13px] text-muted">No labelled issues? You can also paste a postmortem or fill a form on the next page.</p>
        </div>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 rounded-b-2xl border-t border-[#EDEEE9] bg-[#FAFAF8] px-8 py-[18px] max-sm:px-5">
          {step === 0 ? <Link href="/overview" className="inline-flex min-h-11 items-center px-2 text-body no-underline">Skip for now</Link> : <button type="button" onClick={() => setStep(step - 1)} className="min-h-11 cursor-pointer rounded-[9px] border border-line-strong bg-white px-4 font-semibold">Back</button>}
          {step < 3 ? <button type="button" onClick={() => setStep(step + 1)} className="min-h-11 cursor-pointer rounded-[9px] bg-ink px-5 font-semibold text-white">Continue</button> : <button type="submit" className="min-h-11 cursor-pointer rounded-[9px] bg-ink px-5 font-semibold text-white">Finish and import</button>}
        </div>
      </section>
    </form>
  );
}
