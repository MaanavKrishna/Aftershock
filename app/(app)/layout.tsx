import { currentScope } from "@/lib/auth/scope";
import { Sidebar } from "@/components/app/Sidebar";
import { MotionRoot } from "@/components/motion/MotionRoot";

/** The signed-in shell: a 240px glass sidebar (an icon rail from 768 to 1024px, a drawer below), then the page. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { session, scope } = await currentScope();
  return (
    <MotionRoot>
      <div className="app flex min-h-dvh items-stretch bg-canvas text-ui text-fg">
        <a href="#main" className="sr-only z-50 rounded-control bg-fg px-4 py-3 text-canvas focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
          Skip to content
        </a>
        <div className="hidden w-16 shrink-0 md:block lg:w-60">
          <div className="sticky top-0 flex h-dvh">
            <Sidebar scope={scope} userId={session.userId} rail />
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </MotionRoot>
  );
}
