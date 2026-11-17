"use client";
import { Button } from "@/components/ui/Button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main" className="mx-auto flex w-full max-w-2xl flex-col items-start gap-3 px-6 py-16">
      <span className="inline-flex min-h-6 items-center rounded-chip bg-recur-soft px-2 text-caption font-medium text-recur">Error</span>
      <h1 className="m-0 text-title-1 font-semibold text-fg">Something failed while loading this page.</h1>
      <p className="m-0 text-ui text-fg-2">
        Nothing was changed and nothing was marked proven.{" "}
        {error.digest ? (
          <>
            Reference <span className="font-mono">{error.digest}</span>.
          </>
        ) : null}
      </p>
      <Button onClick={reset} className="mt-2">
        Try again
      </Button>
    </main>
  );
}
