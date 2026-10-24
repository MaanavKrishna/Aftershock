import type { Metadata } from "next";
import { currentScope } from "@/lib/auth/scope";
import { TopBar, Main, PageTitle } from "@/components/app/TopBar";
import { InsightsView } from "@/components/app/InsightsView";
import { AskPanel } from "@/components/app/AskPanel";
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
  return (
    <>
      <TopBar title="Insights" />
      <Main>
        <PageTitle title="What your incidents taught the codebase." sub="Proofs, recurrences stopped and the health of your memory tests." />
        <AskPanel />
        <InsightsView i={i} />
        {admin && (
          <section className="flex flex-wrap items-center gap-3 rounded-[14px] border border-line bg-card px-5 py-4 text-[13.5px]">
            <span className="flex-[1_1_320px]">
              <strong>Reliability report.</strong> A read-only page with these numbers (no incident titles, files or code) for leadership or auditors.
              {token && <code className="mt-1.5 block break-all rounded-md bg-card-2 px-2 py-1.5 font-mono text-[12px]">{`${base}/report/${token}`}</code>}
            </span>
            <form action={token ? unshareReport : shareReport}><button type="submit" className="min-h-10 cursor-pointer rounded-[9px] border border-line-strong bg-card px-3.5 font-semibold">{token ? "Stop sharing" : "Create share link"}</button></form>
          </section>
        )}
      </Main>
    </>
  );
}
