"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { finishOnboarding } from "../actions";
import { Button, buttonClass } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Feedback";
import { TextField } from "@/components/ui/Field";
import { Check, Shield } from "@/components/ui/icons";

type Repo = { id: string; name: string; meta: string; framework: string; supported: boolean; install: string };
const STEPS = [
  ["repos", "Repositories", "Where incidents live"],
  ["runner", "Runner", "Sandbox or your Actions"],
  ["model", "Model", "Who drafts the tests"],
  ["incident", "First incident", "Import and prove one"],
] as const;

/** A selectable card: a signal ring marks the choice (it is interactive, not a verdict). */
const option = (on: boolean) =>
  `flex w-full cursor-pointer rounded-card border bg-s1 text-left text-fg transition-[border-color,box-shadow,background-color] duration-150 ease-fl ${on ? "border-signal ring-1 ring-signal" : "border-border hover:border-border-strong hover:bg-s2"}`;

function StepHead({ level, title, sub }: { level: 1 | 2; title: string; sub: ReactNode }) {
  const H = level === 1 ? "h1" : "h2";
  return (
    <div className="flex flex-col gap-1.5">
      <H className="m-0 text-title-1 font-semibold text-fg">{title}</H>
      <p className="m-0 text-ui text-fg-3">{sub}</p>
    </div>
  );
}

export function Wizard({ repos, installUrl }: { repos: Repo[]; installUrl: string | null }) {
  const [step, setStep] = useState(0);
  const [runner, setRunner] = useState<"sandbox" | "actions">("sandbox");
  const [provider, setProvider] = useState<"muse" | "gateway" | "custom">("muse");
  const panel = (i: number) => (step === i ? "flex animate-[fl-in_240ms_var(--ease-fl)] flex-col gap-6 p-8 max-sm:p-5" : "hidden");
  return (
    <form action={finishOnboarding} className="grid items-start gap-8 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10">
      <ol aria-label="Setup steps" className="m-0 grid list-none grid-cols-4 gap-1 p-0 lg:flex lg:flex-col">
        {STEPS.map(([id, label, sub], i) => {
          const done = i < step;
          const now = i === step;
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => setStep(i)}
                aria-current={now ? "step" : undefined}
                className={`flex w-full cursor-pointer flex-col items-center gap-2 rounded-control border-0 px-2 py-2.5 text-center transition-colors duration-150 lg:flex-row lg:gap-3 lg:px-3 lg:text-left ${now ? "bg-s1 shadow-e1 ring-1 ring-border" : "bg-transparent hover:bg-s2"}`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-callout font-semibold tabular-nums transition-colors duration-200 ease-fl ${done ? "bg-fg text-canvas" : now ? "border-2 border-signal text-signal" : "border border-field text-fg-3"}`}
                >
                  {done ? <Check size={14} /> : i + 1}
                  {done && <span className="sr-only">done</span>}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className={`text-caption font-medium lg:text-ui ${now ? "text-fg" : "text-fg-2"}`}>{label}</span>
                  <span className="hidden text-callout text-fg-3 lg:block">{sub}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <section aria-label="Setup" className="flex min-w-0 flex-col overflow-hidden rounded-stage border border-border bg-s1 shadow-e1">
        <div className="flex items-center gap-3 border-b border-border-soft px-8 py-3 max-sm:px-5">
          <span className="text-caption tabular-nums text-fg-3">
            Step {step + 1} of {STEPS.length}
          </span>
          <span role="progressbar" aria-label="Setup progress" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1} className="h-1 flex-1 overflow-hidden rounded-full bg-s2">
            <span className="block h-full rounded-full bg-fg transition-[width] duration-300 ease-fl" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
          </span>
        </div>
        <input type="hidden" name="runner" value={runner} />
        <input type="hidden" name="provider" value={provider} />

        <div className={panel(0)}>
          <StepHead level={1} title="Choose repositories" sub="Pick where Aftershock should remember incidents. You can change this later." />
          {repos.length === 0 ? (
            <p className="m-0 rounded-card border border-dashed border-border-strong p-5 text-ui text-fg-3">
              No repositories yet.{" "}
              {installUrl ? (
                <a href={installUrl} className="font-medium text-signal underline underline-offset-2">
                  Install the GitHub App
                </a>
              ) : (
                "Configure the GitHub App (GITHUB_APP_SLUG) to install it"
              )}{" "}
              on the repositories you want to protect.
            </p>
          ) : (
            <div className="overflow-hidden rounded-card border border-border">
              {repos.map((r) => (
                <label key={r.id} className="flex min-h-14 cursor-pointer items-center gap-3.5 border-b border-border-soft px-4 py-3 transition-colors duration-150 last:border-b-0 hover:bg-s2">
                  <input type="checkbox" name="repo" value={r.id} defaultChecked={r.supported} disabled={!r.supported} className="h-4 w-4 shrink-0 cursor-pointer accent-signal" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-mono text-callout font-semibold text-fg">{r.name}</span>
                    <span className="text-caption text-fg-3">{r.meta}</span>
                  </span>
                  <span className="hidden font-mono sm:inline-flex">
                    <Badge tone="outline">{r.framework}</Badge>
                  </span>
                </label>
              ))}
            </div>
          )}
          <div className="flex gap-3 rounded-control bg-s2 px-4 py-3.5 text-callout text-fg-2">
            <span className="mt-px shrink-0 text-fg-3">
              <Shield size={16} />
            </span>
            <span>
              <span className="font-semibold text-fg">Permissions.</span> Runners get read-only clone tokens. The app writes only to aftershock/* branches to open test PRs, never to your default branch.
            </span>
          </div>
        </div>

        <div className={panel(1)}>
          <StepHead level={2} title="Where should checks run?" sub="Time travel always uses the sandbox. Pull request checks can run there or on your runners." />
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["sandbox", "Aftershock sandbox", "No setup", "Fresh microVM per run, no secrets. Uses your sandbox CPU-hours; checks pause if they run out."],
                ["actions", "Your GitHub Actions", "Unlimited", "Add one workflow file. Runs on your runners with your services; results report to the same check."],
              ] as const
            ).map(([id, name, tag, text]) => (
              <button key={id} type="button" onClick={() => setRunner(id)} aria-pressed={runner === id} className={`${option(runner === id)} min-h-32 flex-col gap-2 p-4`}>
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="text-ui font-semibold">{name}</span>
                  <Badge tone="outline">{tag}</Badge>
                </span>
                <span className="text-callout text-fg-3">{text}</span>
              </button>
            ))}
          </div>
          {repos.length > 0 && (
            <div className="overflow-hidden rounded-card border border-border">
              <div className="border-b border-border-soft bg-s2 px-4 py-2.5 text-caption font-medium text-fg-3">Detected in your repositories</div>
              {repos
                .filter((r) => r.supported)
                .map((r) => (
                  <div key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border-soft px-4 py-3 last:border-b-0">
                    <span className="flex-[1_1_160px] truncate font-mono text-callout font-semibold text-fg">{r.name}</span>
                    <span className="font-mono text-callout text-fg-2">{r.framework}</span>
                    <span className="font-mono text-caption text-fg-3">{r.install}</span>
                  </div>
                ))}
            </div>
          )}
        </div>

        <div className={panel(2)}>
          <StepHead level={2} title="Pick the model that drafts tests" sub="It only drafts. Time travel decides. Any OpenAI-compatible endpoint works." />
          <div role="radiogroup" aria-label="Model provider" className="flex flex-col gap-2">
            {(
              [
                ["muse", "Muse Spark (default)", "Uses the server’s configured key. Nothing to set up.", "ready"],
                ["gateway", "Vercel AI Gateway", "Choose any supported model by name with one key.", "model id"],
                ["custom", "Custom OpenAI-compatible endpoint", "Self-hosted or another provider. Bring the URL and key.", "URL + key"],
              ] as const
            ).map(([id, name, text, note]) => (
              <button key={id} type="button" role="radio" aria-checked={provider === id} onClick={() => setProvider(id)} className={`${option(provider === id)} min-h-16 items-center gap-3.5 px-4 py-3`}>
                <span className={`flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border-2 ${provider === id ? "border-signal" : "border-field"}`}>
                  {provider === id && <span className="h-2 w-2 rounded-full bg-signal" />}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-ui font-semibold">{name}</span>
                  <span className="text-callout text-fg-3">{text}</span>
                </span>
                <span className="hidden font-mono text-caption text-fg-3 sm:block">{note}</span>
              </button>
            ))}
          </div>
          {provider !== "muse" && (
            <div className="grid gap-4 sm:grid-cols-2">
              {provider === "custom" && <TextField label="Base URL" name="baseUrl" type="url" placeholder="https://your-endpoint/v1" mono className="sm:col-span-2" />}
              <TextField label="Model" name="model" placeholder={provider === "gateway" ? "provider/model-name" : "model-name"} mono />
              <TextField label="API key" name="apiKey" type="password" autoComplete="off" placeholder="Stored encrypted. Never shown again." />
            </div>
          )}
        </div>

        <div className={panel(3)}>
          <StepHead
            level={2}
            title="Import your first incident"
            sub={
              <>
                Finish setup to see closed issues labelled <span className="rounded-chip border border-border bg-s2 px-1.5 font-mono text-callout text-fg">incident</span> with a linked fix. Pick one and watch it time travel.
              </>
            }
          />
          <p className="m-0 text-callout text-fg-3">No labelled issues? You can also paste a postmortem or fill a form on the next page.</p>
        </div>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-border-soft bg-s2 px-8 py-4 max-sm:px-5">
          {step === 0 ? (
            <Link href="/overview" className={buttonClass("quiet")}>
              Skip for now
            </Link>
          ) : (
            <Button variant="secondary" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep(step + 1)}>Continue</Button>
          ) : (
            <Button type="submit">Finish and import</Button>
          )}
        </div>
      </section>
    </form>
  );
}
