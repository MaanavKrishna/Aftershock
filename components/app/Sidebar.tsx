import { Suspense } from "react";
import Link from "next/link";
import { LogoMark } from "@/components/ui/Logo";
import { Skeleton } from "@/components/ui/Feedback";
import { ChevronDown } from "@/components/ui/icons";
import { NavList, type NavItem } from "./NavList";
import { hours } from "@/lib/format";
import type { Scoped } from "@/lib/db/queries/scope";

const NAV: NavItem[] = [
  { id: "overview", label: "Overview" },
  { id: "incidents", label: "Incidents" },
  { id: "memory", label: "Memory" },
  { id: "pulls", label: "Pull requests" },
  { id: "insights", label: "Insights" },
  { id: "repositories", label: "Repositories" },
  { id: "integrations", label: "Integrations" },
  { id: "settings", label: "Settings" },
];

/**
 * The workspace sidebar. `rail` (the layout copy) collapses to an icon rail between 768 and 1024px;
 * the drawer copy is always full. The nav renders at once; counts, usage and the switcher stream in.
 */
export function Sidebar({ scope, userId, rail = false }: { scope: Scoped; userId: string; rail?: boolean }) {
  const full = rail ? "max-lg:hidden" : "";
  return (
    <nav aria-label="Workspace navigation" className={`glass flex h-full w-full flex-col gap-4 border-r border-border px-3 pb-4 pt-4 ${rail ? "max-lg:items-center max-lg:px-2 lg:overflow-y-auto" : "overflow-y-auto"}`}>
      <Link href="/overview" aria-label="Aftershock overview" className="flex min-h-10 items-center gap-2.5 rounded-control px-2 text-ui font-semibold text-fg no-underline">
        <LogoMark size={24} accent />
        <span className={full}>Aftershock</span>
      </Link>
      <Suspense fallback={<SwitcherSkeleton rail={rail} />}>
        <Switcher scope={scope} userId={userId} rail={rail} />
      </Suspense>
      <Suspense fallback={<NavList items={NAV} rail={rail} />}>
        <CountedNav scope={scope} rail={rail} />
      </Suspense>
      <div className={`mt-auto flex flex-col gap-3 ${rail ? "max-lg:w-full max-lg:items-center" : ""}`}>
        <Suspense fallback={<FooterSkeleton rail={rail} />}>
          <Footer scope={scope} userId={userId} rail={rail} />
        </Suspense>
      </div>
    </nav>
  );
}

async function CountedNav({ scope, rail }: { scope: Scoped; rail: boolean }) {
  const counts = await scope.navCounts();
  const badge: Record<string, { n: number; hot?: boolean; label: string }> = {
    incidents: { n: counts.open, label: "open" },
    memory: { n: counts.memory, label: "tests" },
    pulls: { n: counts.recur, hot: true, label: "recurring" },
  };
  return <NavList rail={rail} items={NAV.map((n) => (badge[n.id] ? { ...n, badge: badge[n.id].n, hot: badge[n.id].hot, badgeLabel: badge[n.id].label } : n))} />;
}

async function Switcher({ scope, userId, rail }: { scope: Scoped; userId: string; rail: boolean }) {
  const [ws, all] = await Promise.all([scope.workspace(), scope.workspacesFor(userId)]);
  const name = ws?.name ?? "Workspace";
  const initial = <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-chip bg-fg text-caption font-semibold text-canvas">{name[0].toUpperCase()}</span>;
  if (all.length <= 1) {
    return (
      <div title={name} className={`flex min-h-10 items-center gap-2.5 rounded-control border border-border bg-s1 px-2 text-callout font-medium text-fg ${rail ? "max-lg:border-0 max-lg:bg-transparent max-lg:px-0" : ""}`}>
        {initial}
        <span className={`truncate ${rail ? "max-lg:sr-only" : ""}`}>{name}</span>
      </div>
    );
  }
  return (
    <details className="group relative">
      <summary
        aria-label={`Workspace: ${name}. Switch workspace`}
        className={`flex min-h-10 cursor-pointer list-none items-center gap-2.5 rounded-control border border-border bg-s1 px-2 text-callout font-medium text-fg hover:bg-s2 [&::-webkit-details-marker]:hidden ${rail ? "max-lg:border-0 max-lg:bg-transparent max-lg:px-0" : ""}`}
      >
        {initial}
        <span className={`flex-1 truncate ${rail ? "max-lg:hidden" : ""}`}>{name}</span>
        <span className={`text-fg-3 transition-transform duration-200 ease-fl group-open:rotate-180 ${rail ? "max-lg:hidden" : ""}`}>
          <ChevronDown size={14} />
        </span>
      </summary>
      <form action="/api/auth/switch" method="post" className={`absolute inset-x-0 top-full z-40 mt-1 flex flex-col gap-0.5 rounded-control border border-border bg-s1 p-1 shadow-e2 ${rail ? "max-lg:right-auto max-lg:w-56" : ""}`}>
        {all.map((w) => (
          <button
            key={w.id}
            type="submit"
            name="workspaceId"
            value={w.id}
            aria-current={w.id === ws?.id ? "true" : undefined}
            className={`min-h-9 cursor-pointer rounded-chip px-2.5 text-left text-callout ${w.id === ws?.id ? "bg-s2 font-medium text-fg" : "text-fg-2 hover:bg-s2 hover:text-fg"}`}
          >
            {w.name}
          </button>
        ))}
      </form>
    </details>
  );
}

async function Footer({ scope, userId, rail }: { scope: Scoped; userId: string; rail: boolean }) {
  const [me, usage] = await Promise.all([scope.me(userId), scope.usage()]);
  const pct = Math.min(100, (usage.sandboxCpuMs / usage.allowanceMs) * 100);
  const name = me?.user.name ?? me?.user.login ?? "You";
  const full = rail ? "max-lg:hidden" : "";
  return (
    <>
      <div className={`flex flex-col gap-2 rounded-control border border-border bg-s1 p-3 ${full}`}>
        <div className="flex items-baseline justify-between gap-2 text-caption">
          <span className="text-fg-3">Sandbox this month</span>
          <span className="whitespace-nowrap tabular-nums text-fg-2">
            {hours(usage.sandboxCpuMs)} / {hours(usage.allowanceMs)}
          </span>
        </div>
        <div role="meter" aria-label="Sandbox time used this month" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} className="h-1 overflow-hidden rounded-full bg-s3">
          <div className={`h-full rounded-full ${pct >= 100 ? "bg-recur" : "bg-fg-2"}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="text-caption text-fg-3">At the limit, checks pause until a repo switches to Actions.</span>
      </div>
      <div className={`flex items-center gap-2.5 px-1 ${rail ? "max-lg:flex-col max-lg:px-0" : ""}`}>
        <span title={name} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-s3 text-caption font-semibold text-fg">{name[0].toUpperCase()}</span>
        <span className={`flex min-w-0 flex-1 flex-col ${full}`}>
          <span className="truncate text-callout font-medium text-fg">{name}</span>
          <span className="text-caption capitalize text-fg-3">{me?.role ?? "member"}</span>
        </span>
        <form action="/api/auth/signout" method="post" className={full}>
          <button type="submit" className="min-h-8 cursor-pointer rounded-chip px-2 text-caption font-medium text-fg-2 hover:bg-s2 hover:text-fg">
            Sign out
          </button>
        </form>
      </div>
    </>
  );
}

function SwitcherSkeleton({ rail }: { rail: boolean }) {
  return (
    <div className={`flex min-h-10 items-center gap-2.5 rounded-control border border-border px-2 ${rail ? "max-lg:border-0 max-lg:px-0" : ""}`}>
      <Skeleton className="h-6 w-6" />
      <Skeleton className={`h-3 w-24 ${rail ? "max-lg:hidden" : ""}`} />
    </div>
  );
}

function FooterSkeleton({ rail }: { rail: boolean }) {
  return (
    <>
      <div className={`flex flex-col gap-2 rounded-control border border-border p-3 ${rail ? "max-lg:hidden" : ""}`}>
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-1 w-full" />
        <Skeleton className="h-3 w-3/4" />
      </div>
      <div className="flex items-center gap-2.5 px-1">
        <Skeleton className="h-7 w-7 rounded-full" />
        <Skeleton className={`h-3 w-20 ${rail ? "max-lg:hidden" : ""}`} />
      </div>
    </>
  );
}
