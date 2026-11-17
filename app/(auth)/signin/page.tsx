import type { Metadata } from "next";
import Link from "next/link";
import { LogoMark, Wordmark } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { buttonClass } from "@/components/ui/Button";
import { Verdict } from "@/components/ui/Verdict";
import { Check, Github, Ring } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Sign in", alternates: { canonical: "/signin" } };

const ERRORS: Record<string, string> = {
  github_not_configured: "GitHub sign-in is not configured on this server yet. An administrator needs to add the GitHub App settings.",
  github_failed: "GitHub sign-in did not complete. Try again.",
  no_access: "You are no longer a member of that workspace. Sign in again to see the workspaces you belong to.",
};

export default async function SignIn({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const demo = process.env.AFTERSHOCK_DEMO === "1";
  return (
    <div className="relative isolate flex min-h-screen flex-col overflow-hidden bg-canvas">
      <div aria-hidden="true" className="dot-grid pointer-events-none absolute inset-0 -z-10" />
      <header className="flex items-center justify-between px-5 py-4 sm:px-8">
        <Link href="/" aria-label="Aftershock home" className="flex min-h-11 items-center no-underline">
          <Wordmark size={26} />
        </Link>
        <ThemeToggle />
      </header>

      <main id="main" className="flex flex-1 flex-col items-center justify-center gap-6 px-4 pb-16 pt-6">
        <div className="flex w-full max-w-[420px] flex-col gap-6 rounded-stage border border-border bg-s1 p-6 shadow-e2 sm:p-8">
          <div className="flex flex-col gap-4">
            <LogoMark size={36} accent />
            <div className="flex flex-col gap-2">
              <h1 className="m-0 text-balance text-title-2 font-semibold text-fg">Your last incident is waiting to become a test.</h1>
              <p className="m-0 text-ui text-fg-2">Sign in with GitHub. Your workspace is your GitHub organisation, so there is no new password.</p>
            </div>
          </div>

          {error && ERRORS[error] && (
            <p role="alert" className="m-0 rounded-control border border-recur-line bg-recur-soft px-4 py-3 text-callout text-fg">
              {ERRORS[error]}
            </p>
          )}

          <div className="flex flex-col gap-2.5">
            <a href="/api/auth/github" className={buttonClass("primary", "lg", "w-full")}>
              <Github size={18} />
              Continue with GitHub
            </a>
            {demo && (
              <form action="/api/auth/demo" method="post">
                <button type="submit" className={buttonClass("secondary", "lg", "w-full")}>
                  Try the demo workspace
                </button>
              </form>
            )}
          </div>

          <div className="flex flex-col gap-2 border-t border-border-soft pt-5 text-callout">
            <span className="font-medium text-fg">What we ask GitHub for</span>
            <span className="flex gap-2.5 text-fg-2">
              <span aria-hidden="true" className="mt-px text-fg-3">
                <Check size={16} />
              </span>
              Your name, avatar and login
            </span>
            <span className="flex gap-2.5 text-fg-2">
              <span aria-hidden="true" className="mt-px text-fg-3">
                <Check size={16} />
              </span>
              Which organisations you belong to
            </span>
            <span className="flex gap-2.5 text-fg-3">
              <span aria-hidden="true" className="mt-px">
                <Ring size={16} />
              </span>
              Repository access is granted separately, per repository, when you install the app
            </span>
          </div>
        </div>

        <dl aria-label="How an incident becomes a proven test" className="m-0 flex w-full max-w-[420px] flex-col overflow-hidden rounded-card border border-border bg-s1 text-callout shadow-e1">
          {(
            [
              ["Before the fix", "3f2a1c9", <Verdict key="v" kind="failing" label="Fails 3 of 3" size="sm" />],
              ["On the fix", "aa86f56", <Verdict key="v" kind="healthy" label="Passes 3 of 3" size="sm" />],
              ["INC-12", "", <Verdict key="v" kind="proven" size="sm" />],
            ] as const
          ).map(([k, sha, v]) => (
            <div key={k} className="flex items-center justify-between gap-3 border-b border-border-soft px-4 py-2.5 last:border-b-0">
              <dt className="text-fg-2">
                {k} {sha && <span className="font-mono text-fg-3">{sha}</span>}
              </dt>
              <dd className="m-0">{v}</dd>
            </div>
          ))}
        </dl>

        <p className="m-0 text-center text-caption text-fg-3">
          AI drafts. Git history proves. People merge. Read how runs are isolated on the{" "}
          <Link href="/security" className="text-signal underline underline-offset-2">
            security page
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
