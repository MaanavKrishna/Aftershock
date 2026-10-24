"use client";
import "./globals.css";

/** Last-resort error page: shown when even the root layout fails. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <div className="site flex min-h-screen flex-col">
          <main className="mx-auto flex w-full max-w-[640px] flex-1 flex-col justify-center gap-5 px-5 py-16">
            <h1 className="m-0 font-display text-d2 font-semibold tracking-[-0.03em] text-fg">Something broke on our side.</h1>
            <p className="m-0 text-lede text-fg-2">It has been logged{error.digest ? ` as ${error.digest}` : ""}. Try again; if it keeps happening, report it on GitHub with that reference.</p>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={reset} className="inline-flex min-h-11 cursor-pointer items-center rounded-control border-0 bg-fg px-5 font-semibold text-canvas">Try again</button>
              <a href="https://github.com/MaanavKrishna/Aftershock/issues" className="inline-flex min-h-11 items-center rounded-control border border-rule-strong px-5 font-semibold text-fg no-underline">Report it</a>
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
