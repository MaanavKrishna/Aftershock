"use client";
import { useActionState } from "react";
import { askAction, type AskState } from "@/app/(app)/insights/askAction";

export function AskPanel() {
  const [state, action, pending] = useActionState<AskState, FormData>(askAction, {});
  return (
    <section className="flex flex-col gap-3 rounded-[14px] border border-line bg-card px-5 py-4" aria-labelledby="ask-h">
      <h2 id="ask-h" className="m-0 text-base font-semibold">Ask Aftershock</h2>
      <form action={action} className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="ask-q">Question</label>
        <input id="ask-q" name="question" defaultValue={state.question} maxLength={500} placeholder="What breaks when we touch checkout?" className="min-h-[44px] flex-[1_1_320px] rounded-[9px] border border-field px-3" />
        <button type="submit" disabled={pending} className="min-h-[44px] cursor-pointer rounded-[9px] bg-ink px-4 font-semibold text-white">{pending ? "Thinking…" : "Ask"}</button>
      </form>
      {state.error && <p role="alert" className="m-0 text-[13px] text-fail-deep">{state.error}</p>}
      {state.result && (
        <div role="status" className="flex flex-col gap-2 text-[14px]">
          <p className="m-0">{state.result.answer}</p>
          {state.result.citations.length > 0 && (
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {state.result.citations.map((c) => <li key={c.key}><a href={c.url.replace(/^https?:\/\/[^/]+/, "")} className="inline-flex min-h-8 items-center rounded-md border border-line px-2 font-mono text-[12.5px] text-ink no-underline">{c.key} · {c.title.slice(0, 50)}</a></li>)}
            </ul>
          )}
          <span className="text-[12px] text-muted">Answers come only from your incidents and always cite them.</span>
        </div>
      )}
    </section>
  );
}
