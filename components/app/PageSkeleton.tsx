import { Skeleton } from "@/components/ui/Feedback";

/** Route loading states that match each page's layout, so content cross-fades in without a jump. */
function Bar() {
  return (
    <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4 sm:px-6 lg:px-8">
      <Skeleton className="h-4 w-28" />
      <span className="flex-1" />
      <Skeleton className="h-8 w-8 md:w-52" />
      <Skeleton className="h-8 w-8" />
    </div>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Bar />
      <main aria-busy="true" className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-16 pt-6 sm:px-6 lg:px-8 lg:pt-8">
        <span className="sr-only" role="status">
          Loading…
        </span>
        {children}
      </main>
    </>
  );
}

function Title({ sub = true }: { sub?: boolean }) {
  return (
    <div className="flex flex-col gap-2.5">
      <Skeleton className="h-7 w-full max-w-md" />
      {sub && <Skeleton className="h-4 w-full max-w-xl" />}
    </div>
  );
}

function Rows({ n = 8, cols = 4 }: { n?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded-card border border-border bg-s1">
      <div className="flex h-10 items-center gap-6 border-b border-border px-4">
        {Array.from({ length: cols }, (_, i) => (
          <Skeleton key={i} className={`h-3 ${i === 1 ? "w-40" : "w-14"}`} />
        ))}
      </div>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="flex h-14 items-center gap-6 border-b border-border-soft px-4 last:border-b-0">
          <Skeleton className="h-3 w-12" />
          <span className="flex flex-1 flex-col gap-1.5">
            <Skeleton className={`h-3 ${["w-3/5", "w-2/5", "w-1/2", "w-2/3"][i % 4]}`} />
            <Skeleton className="h-2.5 w-1/4" />
          </span>
          <Skeleton className="h-6 w-20 max-sm:hidden" />
        </div>
      ))}
    </div>
  );
}

function Panel({ h = "h-40" }: { h?: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-card border border-border bg-s1 p-5">
      <Skeleton className="h-4 w-32" />
      <Skeleton className={`${h} w-full`} />
    </div>
  );
}

export function ListSkeleton({ filters = true }: { filters?: boolean }) {
  return (
    <Frame>
      <Title />
      {filters && <Skeleton className="h-9 w-full max-w-lg" />}
      <Rows />
    </Frame>
  );
}

export function OverviewSkeleton() {
  return (
    <Frame>
      <Title sub={false} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-2 rounded-card border border-border bg-s1 p-5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-14" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Rows n={5} cols={3} />
        </div>
        <Panel h="h-48" />
      </div>
    </Frame>
  );
}

export function DetailSkeleton() {
  return (
    <Frame>
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 w-28" />
        </div>
        <Skeleton className="h-8 w-full max-w-2xl" />
      </div>
      <div className="rounded-card border border-border bg-s1 p-5">
        <div className="grid gap-3 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Panel h="h-28" />
          <Panel h="h-40" />
        </div>
        <Panel h="h-64" />
      </div>
    </Frame>
  );
}
