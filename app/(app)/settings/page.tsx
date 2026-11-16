import type { Metadata } from "next";
import { currentScope } from "@/lib/auth/scope";
import { TopBar, Main } from "@/components/app/TopBar";
import { Tabs } from "@/components/ui/Tabs";
import { flagEnabled } from "@/lib/flags";
import { can } from "@/lib/auth/roles";
import { AdmissionTab, BillingTab, LabsTab, WorkspaceTab } from "@/components/app/settings/GeneralTabs";
import { MembersTab, SessionsTab, TokensTab } from "@/components/app/settings/PeopleTabs";
import { AuditTab, DangerTab, NotificationsTab } from "@/components/app/settings/ActivityTabs";
import { testLimit } from "@/components/app/Pager";

export const metadata: Metadata = { title: "Settings" };

const TABS = [
  ["workspace", "Workspace"],
  ["admission", "Admission rules"],
  ["team", "Team"],
  ["tokens", "API tokens"],
  ["billing", "Plan and usage"],
  ["notifications", "Notifications"],
  ["labs", "Labs"],
  ["sessions", "Sessions"],
  ["audit", "Audit log"],
  ["danger", "Danger zone"],
] as const;
type Tab = (typeof TABS)[number][0];

export default async function Settings({ searchParams }: { searchParams: Promise<{ tab?: string; error?: string; cursor?: string; limit?: string }> }) {
  const { tab: t, error, cursor, limit } = await searchParams;
  const tab: Tab = TABS.find(([id]) => id === t)?.[0] ?? "workspace";
  const { scope, session } = await currentScope();
  const [ws, members, tokens, usage, repos, me] = await Promise.all([scope.workspace(), scope.members(), scope.tokens(), scope.usage(), scope.repos(), scope.me(session.userId)]);
  const admin = can(me?.role, "manageWorkspace");
  const owner = me?.role === "owner";
  const audit = tab === "audit" && admin ? await scope.auditPage({ cursor, limit: testLimit(limit) }) : { rows: [], nextCursor: null };
  const mySessions = tab === "sessions" ? await (await import("@/lib/auth/sessions")).listSessions(session.userId) : [];
  const [targets, sent] = tab === "notifications" ? await Promise.all([scope.notificationTargets(), scope.notificationLog(15)]) : [[], []];
  if (!ws) return null;
  const label = TABS.find(([id]) => id === tab)![1];
  return (
    <>
      <TopBar title="Settings" />
      <Main>
        <header className="flex flex-col gap-1">
          <h1 className="m-0 text-title-1 font-semibold text-fg">
            Settings<span className="sr-only"> · {label}</span>
          </h1>
          <p className="m-0 text-ui text-fg-3">
            {ws.name} · <span className="font-mono">{ws.login}</span>
          </p>
        </header>
        <Tabs label="Settings sections" items={TABS.map(([id, l]) => ({ href: `/settings?tab=${id}`, label: l, active: id === tab }))} />
        <div className="flex w-full max-w-4xl flex-col gap-4">
          {tab === "workspace" && <WorkspaceTab ws={ws} />}
          {tab === "admission" && <AdmissionTab />}
          {tab === "team" && <MembersTab members={members} owner={owner} me={session.userId} error={error} />}
          {tab === "tokens" && <TokensTab tokens={tokens} />}
          {tab === "billing" && <BillingTab ws={ws} usage={usage} repoCount={repos.length} />}
          {tab === "notifications" && <NotificationsTab enabled={flagEnabled("notifications", ws.settings)} admin={admin} targets={targets} sent={sent} />}
          {tab === "labs" && <LabsTab ws={ws} admin={admin} />}
          {tab === "sessions" && <SessionsTab sessions={mySessions} current={session.sid ?? ""} />}
          {tab === "audit" && <AuditTab admin={admin} audit={audit.rows} cursor={cursor} nextCursor={audit.nextCursor} limit={limit} />}
          {tab === "danger" && <DangerTab login={ws.login} owner={owner} />}
        </div>
      </Main>
    </>
  );
}
