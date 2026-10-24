import type { Metadata } from "next";
import Link from "next/link";
import { LogoMark } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ds/ThemeToggle";

export const metadata: Metadata = { title: "Sign in", alternates: { canonical: "/signin" } };

const ERRORS: Record<string, string> = {
  github_not_configured: "GitHub sign-in is not configured on this server yet. An administrator needs to add the GitHub App settings.",
  github_failed: "GitHub sign-in did not complete. Try again.",
};

export default async function SignIn({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const demo = process.env.AFTERSHOCK_DEMO === "1";
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="flex flex-col gap-12 border-b border-rule bg-sunken px-[clamp(20px,5vw,64px)] py-8 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex min-h-11 items-center gap-2.5 font-display text-[19px] font-semibold tracking-[-0.02em] text-fg no-underline"><LogoMark size={28} accent />Aftershock</Link>
          <ThemeToggle />
        </div>
        <div className="mt-auto flex max-w-[540px] flex-col gap-7">
          <h1 className="m-0 text-balance font-display text-d2 font-semibold tracking-[-0.03em] text-fg">Your last incident is waiting to become a test.</h1>
          <dl className="m-0 grid gap-0 overflow-hidden rounded-panel border border-rule bg-raised text-[14px]">
            {[["Before the fix", "3f2a1c9", "fails 3 of 3", "text-quake"], ["On the fix", "aa86f56", "passes 3 of 3", "text-signal"], ["INC-12", "", "proven", "text-signal"]].map(([k, sha, v, c]) => (
              <div key={k} className="flex items-center justify-between gap-3 border-t border-rule px-5 py-3.5 first:border-t-0">
                <dt className="text-fg-2">{k} {sha && <span className="font-code text-fg-3">{sha}</span>}</dt>
                <dd className={`m-0 font-semibold ${c}`}>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <p className="m-0 text-[13px] text-fg-3">AI drafts. Git history proves. People merge.</p>
      </section>
      <main id="main" className="flex items-center justify-center px-5 py-12">
        <div className="flex w-full max-w-[400px] flex-col gap-6">
          <div className="flex flex-col gap-1.5">
            <h2 className="m-0 font-display text-[30px] font-semibold tracking-[-0.025em] text-fg">Sign in</h2>
            <p className="m-0 text-fg-2">Your workspace is your GitHub organisation. No new password.</p>
          </div>
          {error && ERRORS[error] && <p role="alert" className="m-0 rounded-control bg-quake-soft px-4 py-3 text-[14px] text-quake">{ERRORS[error]}</p>}
          <a href="/api/auth/github" className="flex min-h-[52px] items-center justify-center gap-2.5 rounded-control bg-fg text-[15.5px] font-semibold text-canvas no-underline hover:bg-fg-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.33-1.29-1.69-1.29-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a10.9 10.9 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.7 5.4-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5z" /></svg>
            Continue with GitHub
          </a>
          {demo && (
            <form action="/api/auth/demo" method="post">
              <button type="submit" className="flex min-h-12 w-full cursor-pointer items-center justify-center rounded-control border border-rule-strong bg-transparent font-semibold text-fg hover:border-fg-3">Try the demo workspace</button>
            </form>
          )}
          <div className="flex flex-col gap-2.5 rounded-panel border border-rule bg-raised px-5 py-4 text-[14px]">
            <span className="font-semibold text-fg">What we ask GitHub for</span>
            <span className="flex gap-2.5 text-fg-2"><span aria-hidden="true" className="w-4 text-signal">✓</span>Your name, avatar and login</span>
            <span className="flex gap-2.5 text-fg-2"><span aria-hidden="true" className="w-4 text-signal">✓</span>Which organisations you belong to</span>
            <span className="flex gap-2.5 text-fg-3"><span aria-hidden="true" className="w-4">○</span>Repository access is granted separately, per repository, when you install the app</span>
          </div>
          <p className="m-0 text-[13px] text-fg-3">Read how runs are isolated on the <Link href="/security" className="text-signal">security page</Link>.</p>
        </div>
      </main>
    </div>
  );
}
