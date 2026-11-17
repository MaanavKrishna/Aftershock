import type { Metadata } from "next";
import { currentScope } from "@/lib/auth/scope";
import { TopBar, Main } from "@/components/app/TopBar";
import { InsightsView } from "@/components/app/InsightsView";
import { AskPanel } from "@/components/app/AskPanel";
import { PageHeader } from "@/components/ui/Feedback";
import { Card, CardBody, CardHead } from "@/components/ui/Card";
import { buttonClass } from "@/components/ui/Button";
import { CopyText } from "@/components/ui/CopyText";
import { insightsFrom } from "@/lib/domain/insights";
import { can } from "@/lib/auth/roles";
import { shareReport, unshareReport } from "../actions";

export const metadata: Metadata = { title: "Insights" };

export default async function InsightsPage() {
  const { scope, session } = await currentScope();
  const [ws, data, me] = await Promise.all([scope.workspace(), scope.insightsData(), scope.me(session.userId)]);
  const i = insightsFrom(data);
  const admin = can(me?.role, "manageWorkspace");
  const token = ws?.settings.reportToken;
  const base = (process.env.APP_URL ?? "").replace(/\/$/, "");
  const link = token ? `${base}/report/${token}` : null;
  return (
    <>
      <TopBar title="Insights" />
      <Main>
        <PageHeader title="What your incidents taught the codebase." sub="Proofs, recurrences stopped and the health of your memory tests." />
        <AskPanel />
        <InsightsView i={i} />
        {admin && (
          <Card>
            <CardHead
              sub="A read-only page with these numbers, without incident titles, files or code. For leadership or auditors."
              aside={
                <form action={token ? unshareReport : shareReport}>
                  <button type="submit" className={buttonClass(token ? "dangerOutline" : "secondary", "sm")}>
                    {token ? "Stop sharing" : "Create share link"}
                  </button>
                </form>
              }
            >
              Reliability report
            </CardHead>
            {link && (
              <CardBody className="flex flex-wrap items-center gap-2">
                <code className="min-w-0 flex-1 break-all rounded-chip bg-sunken px-2.5 py-2 font-mono text-callout text-fg-2">{link}</code>
                <CopyText text={link} label="Copy link" />
              </CardBody>
            )}
          </Card>
        )}
      </Main>
    </>
  );
}
