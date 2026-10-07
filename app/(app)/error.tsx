"use client";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex flex-col gap-3 px-8 py-10">
      <span className="font-mono text-[11.5px] text-fail-deep">ERROR</span>
      <h1 className="m-0 text-[26px] font-semibold tracking-[-0.025em]">Something failed while loading this page.</h1>
      <p className="m-0 max-w-[640px] text-body">Nothing was changed and nothing was marked proven. {error.digest ? `Reference: ${error.digest}.` : ""}</p>
      <button type="button" onClick={reset} className="min-h-[42px] cursor-pointer self-start rounded-[9px] bg-ink px-4 font-semibold text-white">Retry</button>
    </main>
  );
}
