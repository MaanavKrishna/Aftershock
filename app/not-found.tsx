import { LogoMark } from "@/components/ui/Logo";
import { ButtonLink } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="site relative isolate flex min-h-screen flex-col overflow-hidden">
      <div aria-hidden="true" className="dot-grid pointer-events-none absolute inset-0 -z-10" />
      <main id="main" className="mx-auto flex w-full max-w-[640px] flex-1 flex-col justify-center gap-6 px-4 py-16 sm:px-6">
        <LogoMark size={36} accent />
        <p className="m-0 font-mono text-caption uppercase text-fg-3">404</p>
        <h1 className="m-0 text-balance text-display-2 font-semibold text-fg">Nothing here, or nothing you can see.</h1>
        <p className="m-0 text-lede text-fg-2">The link may be old. Incidents and checks belong to a workspace, so check you’re signed in to the right one.</p>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/overview" size="lg">Go to your workspace</ButtonLink>
          <ButtonLink href="/" size="lg" variant="secondary">Home</ButtonLink>
        </div>
      </main>
    </div>
  );
}
