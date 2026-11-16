"use client";
import { useActionState } from "react";
import { askAction, type AskState } from "@/app/(app)/insights/askAction";
import { inputClass } from "@/components/ui/Field";
import { buttonClass } from "@/components/ui/Button";

/** Ask a question of the workspace's incidents; answers always cite them. */
export function AskPanel() {
  const [state, action, pending] = useActionState<AskState, FormData>(askAction, {});
  return (
    <section className="flex flex-col gap-3 rounded-card border border-border bg-s1 px-5 py-4 shadow-e1" aria-labelledby="ask-h">
      <h2 id="ask-h" className="m-0 text-title-3 font-semibold text-fg">
        Ask Aftershock
      </h2>
      <form action={action} className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="ask-q">
          Question
        </label>
        <input id="ask-q" name="question" defaultValue={state.question} maxLength={500} placeholder="What breaks when we touch checkout?" className={`${inputClass} min-w-0 flex-[1_1_320px]`} />
        <button type="submit" disabled={pending} aria-busy={pending} className={buttonClass("primary", "md")}>
          {pending ? "Thinking…" : "Ask"}
        </button>
      </form>
      {state.error && (
        <p role="alert" className="m-0 text-callout font-medium text-recur">
          {state.error}
        </p>
      )}
      {state.result && (
        <div role="status" className="flex flex-col gap-2 text-ui text-fg">
          <p className="m-0">{state.result.answer}</p>
          {state.result.citations.length > 0 && (
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {state.result.citations.map((c) => (
                <li key={c.key}>
                  <a href={c.url.replace(/^https?:\/\/[^/]+/, "")} className="inline-flex min-h-8 items-center rounded-chip border border-border-strong px-2 font-mono text-caption text-fg no-underline hover:bg-s2">
                    {c.key} · {c.title.slice(0, 50)}
                  </a>
                </li>
              ))}
            </ul>
          )}
          <span className="text-caption text-fg-3">Answers come only from your incidents and always cite them.</span>
        </div>
      )}
    </section>
  );
}
