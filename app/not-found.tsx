import Link from "next/link";
import { LogoMark } from "@/components/ui/Logo";

export default function NotFound() {
  return (
    <div className="site flex min-h-screen flex-col">
      <main id="main" className="mx-auto flex w-full max-w-[640px] flex-1 flex-col justify-center gap-5 px-5 py-16">
        <LogoMark size={36} accent />
        <h1 className="m-0 font-display text-d2 font-semibold tracking-[-0.03em] text-fg">Nothing here, or nothing you can see.</h1>
        <p className="m-0 text-lede text-fg-2">The link may be old. Incidents and checks belong to a workspace, so check you’re signed in to the right one.</p>
        <div className="flex flex-wrap gap-3">
          <Link href="/overview" className="inline-flex min-h-11 items-center rounded-control bg-fg px-5 font-semibold text-canvas no-underline">Go to your workspace</Link>
          <Link href="/" className="inline-flex min-h-11 items-center rounded-control border border-rule-strong px-5 font-semibold text-fg no-underline">Home</Link>
        </div>
      </main>
    </div>
  );
}
