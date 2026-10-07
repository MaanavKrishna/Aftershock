import Link from "next/link";
import { LogoMark } from "@/components/ui/Logo";
import { NavList } from "./NavList";
import { hours } from "@/lib/format";
import type { Scoped } from "@/lib/db/queries/scope";

export async function Sidebar({ scope, userId }: { scope: Scoped; userId: string }) {
  const [ws, me, counts, usage] = await Promise.all([scope.workspace(), scope.me(userId), scope.navCounts(), scope.usage()]);
  const pct = Math.min(100, (usage.sandboxCpuMs / usage.allowanceMs) * 100);
  const name = me?.user.name ?? me?.user.login ?? "You";
  return (
    <nav aria-label="Workspace navigation" className="box-border flex max-w-full flex-[1_1_248px] flex-col gap-5 bg-ink px-3.5 pb-5 pt-[18px] text-[#C9D1DA]">
      <Link href="/" className="flex min-h-11 items-center gap-2.5 px-2 text-base font-bold tracking-[-0.02em] text-white no-underline">
        <LogoMark size={28} inverted />
        Aftershock
      </Link>
      <div className="flex min-h-11 items-center gap-2.5 rounded-[9px] border border-ink-line bg-ink-2 px-2.5 text-[13.5px] text-on-dark">
        <span className="flex h-[22px] w-[22px] items-center justify-center rounded-md bg-[#344150] text-[11px] font-bold">{(ws?.name ?? "W")[0].toUpperCase()}</span>
        <span className="flex-1 truncate">{ws?.name}</span>
      </div>
      <NavList
        items={[
          { id: "overview", label: "Overview" },
          { id: "incidents", label: "Incidents", badge: counts.open },
          { id: "memory", label: "Memory", badge: counts.memory },
          { id: "pulls", label: "Pull requests", badge: counts.recur, hot: true },
          { id: "repositories", label: "Repositories" },
          { id: "integrations", label: "Integrations" },
          { id: "settings", label: "Settings" },
        ]}
      />
      <div className="mt-auto flex flex-col gap-3.5">
        <div className="flex flex-col gap-2 rounded-[10px] border border-ink-line bg-ink-2 p-3">
          <div className="flex justify-between text-xs">
            <span className="text-on-dark-muted">Sandbox this month</span>
            <span className="font-mono text-on-dark">
              {hours(usage.sandboxCpuMs)} / {hours(usage.allowanceMs)}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-[3px] bg-ink-line">
            <div className={`h-full ${pct >= 100 ? "bg-fail-dark" : "bg-pass-dark"}`} style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[11.5px] text-[#7D8896]">Checks fall back to your Actions at the limit</span>
        </div>
        <div className="flex items-center gap-2.5 px-1.5">
          <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-[#344150] text-xs font-semibold text-white">{name[0].toUpperCase()}</span>
          <span className="flex flex-1 flex-col text-[12.5px] leading-tight">
            <span className="font-semibold text-on-dark">{name}</span>
            <span className="capitalize text-[#7D8896]">{me?.role ?? "member"}</span>
          </span>
          <form action="/api/auth/signout" method="post">
            <button type="submit" className="min-h-9 cursor-pointer rounded-md px-2 text-xs text-on-dark-muted hover:text-white">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </nav>
  );
}
