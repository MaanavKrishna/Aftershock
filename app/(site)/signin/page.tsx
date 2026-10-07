import Link from "next/link";
import { LogoMark } from "@/components/ui/Logo";

const ERRORS: Record<string, string> = {
  github_not_configured: "GitHub sign-in is not configured on this server yet. Use the demo workspace, or set AUTH_GITHUB_ID and AUTH_GITHUB_SECRET.",
  github_failed: "GitHub sign-in did not complete. Try again.",
};

export default async function SignIn({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const demo = process.env.AFTERSHOCK_DEMO === "1";
  return (
    <div className="flex min-h-screen flex-wrap bg-site text-[15px] leading-[1.55] text-ink">
      <section className="flex min-w-0 flex-[1_1_520px] flex-col gap-12 bg-ink px-[clamp(24px,5vw,64px)] py-10 text-on-dark">
        <Link href="/" className="flex min-h-11 items-center gap-2.5 text-[19px] font-bold tracking-[-0.02em] text-white no-underline">
          <LogoMark inverted />
          Aftershock
        </Link>
        <div className="mt-auto flex max-w-[540px] flex-col gap-7">
          <h1 className="m-0 text-[clamp(32px,3.4vw,46px)] font-semibold leading-[1.08] tracking-[-0.03em] text-white">Your last incident is waiting to become a test.</h1>
          <div className="flex flex-col gap-2.5 rounded-xl border border-ink-line bg-ink-2 px-5 py-[18px] font-mono text-[13px]">
            <div className="flex justify-between gap-2.5"><span className="text-on-dark-muted">before fix · 3f2a1c9</span><span className="font-semibold text-fail-dark">fails 3/3</span></div>
            <div className="flex justify-between gap-2.5"><span className="text-on-dark-muted">fix · aa86f56</span><span className="font-semibold text-pass-dark">passes 3/3</span></div>
            <div className="flex justify-between gap-2.5 border-t border-ink-line pt-2.5"><span>INC-12</span><span className="font-semibold">proven</span></div>
          </div>
        </div>
        <div className="font-mono text-[12.5px] text-muted-2">AI drafts · Git history proves · Humans merge</div>
      </section>
      <main className="flex min-w-0 flex-[1_1_480px] items-center justify-center px-6 py-12">
        <div className="flex w-full max-w-[400px] flex-col gap-6">
          <div className="flex flex-col gap-1.5">
            <h2 className="m-0 text-[28px] font-semibold tracking-[-0.025em]">Sign in</h2>
            <p className="m-0 text-muted">Your workspace is your GitHub organisation. No new password.</p>
          </div>
          {error && ERRORS[error] && <p role="alert" className="m-0 rounded-[10px] border border-[#E8C4B0] bg-fail-tint px-4 py-3 text-[13.5px] text-fail-ink">{ERRORS[error]}</p>}
          <a href="/api/auth/github" className="flex min-h-[52px] items-center justify-center gap-2.5 rounded-[10px] bg-ink text-[15.5px] font-semibold text-white no-underline">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="6" cy="6" r="2.5" /><circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="9" r="2.5" /><path d="M6 8.5v7" /><path d="M18 11.5c0 3-3 3.5-6 4.5" /></svg>
            Continue with GitHub
          </a>
          {demo && (
            <form action="/api/auth/demo" method="post">
              <button type="submit" className="flex min-h-12 w-full cursor-pointer items-center justify-center rounded-[10px] border border-field bg-white font-semibold text-ink">Try the demo workspace</button>
            </form>
          )}
          <div className="flex flex-col gap-2.5 rounded-xl border border-[#DCDDD8] bg-white px-[18px] py-4 text-[13.5px]">
            <span className="font-semibold">What we ask GitHub for</span>
            <span className="flex gap-2.5 text-body"><span className="w-4 font-mono text-pass">✓</span>Your name, avatar and login</span>
            <span className="flex gap-2.5 text-body"><span className="w-4 font-mono text-pass">✓</span>Which organisations you belong to</span>
            <span className="flex gap-2.5 text-muted"><span className="w-4 font-mono text-muted-2">→</span>Repository access is granted separately, per repo, when you install the app</span>
          </div>
          <p className="m-0 text-[12.5px] text-muted">
            Read how runs are isolated on the <Link href="/security" className="text-pass">security page</Link>.
          </p>
        </div>
      </main>
    </div>
  );
}
