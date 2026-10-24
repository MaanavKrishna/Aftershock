import { requireSession } from "@/lib/auth/session";
import { scoped } from "@/lib/db/queries/scope";
import { Sidebar } from "@/components/app/Sidebar";
import { MotionRoot } from "@/components/motion/MotionRoot";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const scope = scoped(session.workspaceId);
  return (
    <div className="app flex min-h-screen items-stretch bg-paper text-sm leading-[1.55] text-ink">
      <a href="#main" className="sr-only z-50 rounded-lg bg-ink px-4 py-3 text-paper focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to content</a>
      <div className="hidden w-[248px] shrink-0 lg:block">
        <div className="sticky top-0 flex h-screen">
          <Sidebar scope={scope} userId={session.userId} />
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col"><MotionRoot>{children}</MotionRoot></div>
    </div>
  );
}
