"use client";
import "./globals.css";
import { buttonClass } from "@/components/ui/Button";

/** Last-resort error page: shown when even the root layout fails. It follows the system theme. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-16 text-fg">
          <div className="flex w-full max-w-[520px] flex-col gap-5 rounded-stage border border-border bg-s1 p-6 shadow-e2 sm:p-8">
            <span className="inline-flex w-fit items-center gap-1.5 rounded-chip bg-recur-soft px-2 py-0.5 text-caption font-medium text-recur">Error</span>
            <div className="flex flex-col gap-2">
              <h1 className="m-0 text-title-1 font-semibold text-fg">Something broke on our side.</h1>
              <p className="m-0 text-ui text-fg-2">
                It has been logged{error.digest ? " as " : ""}
                {error.digest && <code className="rounded-chip bg-sunken px-1.5 py-0.5 font-mono text-callout text-fg">{error.digest}</code>}. Try again; if it keeps happening, report it on GitHub with that reference.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={reset} className={buttonClass("primary")}>
                Try again
              </button>
              <a href="https://github.com/MaanavKrishna/Aftershock/issues" className={buttonClass("secondary")}>
                Report it
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
