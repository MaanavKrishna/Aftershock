import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-[560px] flex-col justify-center gap-3 px-6">
      <span className="font-mono text-[11.5px] text-muted-2">NOT FOUND</span>
      <h1 className="m-0 text-[28px] font-semibold tracking-[-0.025em]">This doesn’t exist, or you can’t see it.</h1>
      <p className="m-0 text-body">Incidents and checks belong to a workspace. Check you’re signed in to the right one.</p>
      <Link href="/overview" className="inline-flex min-h-[42px] items-center self-start rounded-[9px] border border-line-strong bg-white px-4 font-semibold text-ink no-underline">Back to overview</Link>
    </main>
  );
}
