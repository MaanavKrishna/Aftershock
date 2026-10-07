import { requireSession } from "@/lib/auth/session";
import { scoped } from "@/lib/db/queries/scope";
import { Sidebar } from "@/components/app/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const scope = scoped(session.workspaceId);
  return (
    <div className="flex min-h-screen flex-wrap items-stretch bg-paper text-sm leading-[1.55]">
      <Sidebar scope={scope} userId={session.userId} />
      <div className="flex min-w-0 flex-[999_1_640px] flex-col">{children}</div>
    </div>
  );
}
