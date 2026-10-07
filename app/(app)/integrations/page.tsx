import Link from "next/link";
import { currentScope } from "@/lib/auth/scope";
import { TopBar, Main, PageTitle } from "@/components/app/TopBar";
import { Card, CardHead } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { timeAgo } from "@/lib/format";

const KINDS = {
  github: { name: "GitHub App", text: "Repos, issues, checks and bot pull requests.", icon: "M6 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M18 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M6 9v12 M18 15V9a3 3 0 0 0-3-3h-4" },
  sentry: { name: "Sentry", text: "New error issues open incidents in Awaiting fix.", icon: "M3 18 12 4l9 14H3z M12 10v3 M12 15.5h.01" },
  pagerduty: { name: "PagerDuty", text: "Resolved incidents with notes become incidents here.", icon: "M6 3v18 M6 4h7a4 4 0 0 1 0 8H6" },
  model: { name: "Model provider", text: "Drafts tests and triages pull requests. Never decides.", icon: "M12 3l2.5 5.5L20 11l-5.5 2.5L12 19l-2.5-5.5L4 11l5.5-2.5z" },
} as const;
type Kind = keyof typeof KINDS;

export default async function Integrations({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind: k } = await searchParams;
  const kind: Kind = k && k in KINDS ? (k as Kind) : "github";
  const { scope } = await currentScope();
  const [ws, integrations, repos, log] = await Promise.all([scope.workspace(), scope.integrations(), scope.repos(), scope.deliveries(kind)]);
  const base = process.env.APP_URL ?? "https://[your-domain]";
  const by = Object.fromEntries(integrations.map((i) => [i.kind, i]));
  const connected: Record<Kind, boolean> = { github: Boolean(ws?.installationId) || repos.length > 0, sentry: Boolean(by.sentry?.enabled), pagerduty: Boolean(by.pagerduty?.enabled), model: Boolean(by.model?.enabled) || Boolean(process.env.MODEL_API_KEY) };
  const modelName = by.model?.config.model ?? process.env.MODEL_NAME ?? "muse-spark-1.3-contributor";
  const state: Record<Kind, string> = { github: connected.github ? "Installed" : "Not installed", sentry: connected.sentry ? "Connected" : "Not connected", pagerduty: connected.pagerduty ? "Connected" : "Not connected", model: connected.model ? (by.model?.config.provider === "gateway" ? "AI Gateway" : "Muse Spark") : "Not configured" };
  const fields: Record<Kind, [string, string, string][]> = {
    github: [["Installation", `${ws?.name} · ${repos.length} repositories`, "Add or remove repositories on GitHub."], ["Permissions", "contents: read · issues: read · checks: write · pull_requests: write", "Aftershock never pushes to a default branch."]],
    sentry: [["Webhook URL", `${base}/api/webhooks/sentry?workspace=${ws?.login}`, "Paste into Sentry → Settings → Integrations → Webhooks."], ["Signing secret", by.sentry?.config.secretHint ? `••••••••••••••••${by.sentry.config.secretHint}` : "Not set", "Deliveries without a valid HMAC signature are rejected."], ["Rule", by.sentry?.config.rule ?? "level ≥ error", "Map Sentry projects to repositories."]],
    pagerduty: [["Webhook URL", `${base}/api/webhooks/pagerduty?workspace=${ws?.login}`, "Add as a generic V3 webhook subscription."], ["Signing secret", by.pagerduty?.config.secretHint ? `••••••••••••••••${by.pagerduty.config.secretHint}` : "Not set", "Checked against the X-PagerDuty-Signature header."], ["Services", by.pagerduty?.config.services ?? "None mapped", "Only mapped services create incidents."]],
    model: [["Provider", by.model?.config.provider === "gateway" ? "Vercel AI Gateway" : by.model?.config.provider === "custom" ? "Custom OpenAI-compatible endpoint" : "Muse · OpenAI-compatible", "Or Vercel AI Gateway, or any OpenAI-compatible endpoint."], ["Model", modelName, "Used for drafting tests, triage and postmortem extraction."], ["API key", connected.model ? "•••••••••••••••••••• (server)" : "Not set", "Encrypted at rest. Never sent to a sandbox."]],
  };
  return (
    <>
      <TopBar title="Integrations" />
      <Main>
        <PageTitle title="Where incidents come from, and who drafts the tests." sub="Every delivery is verified by signature before anything is stored or run." />
        <nav aria-label="Integrations" className="grid grid-cols-[repeat(auto-fit,minmax(min(230px,100%),1fr))] gap-2.5">
          {(Object.keys(KINDS) as Kind[]).map((id) => (
            <Link key={id} href={`/integrations?kind=${id}`} aria-current={kind === id ? "page" : undefined} className={`flex min-h-[150px] flex-col items-start gap-2.5 rounded-[14px] bg-white p-[18px] text-inherit no-underline ${kind === id ? "border-2 border-ink" : "border border-line"}`}>
              <span className="flex w-full items-center justify-between gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-[9px] bg-ink text-white"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={KINDS[id].icon} /></svg></span>
                <Pill tone={connected[id] ? "pass" : "dashed"}>{state[id]}</Pill>
              </span>
              <span className="text-[15px] font-semibold">{KINDS[id].name}</span>
              <span className="text-[13px] text-muted">{KINDS[id].text}</span>
            </Link>
          ))}
        </nav>
        <div className="flex flex-wrap items-start gap-4">
          <Card className="min-w-0 flex-[1.5_1_520px]">
            <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[#EDEEE9] px-[22px] py-[18px]"><h2 className="m-0 text-lg font-semibold tracking-[-0.015em]">{KINDS[kind].name}</h2><Pill tone={connected[kind] ? "pass" : "dashed"}>{state[kind]}</Pill></div>
            <div className="flex flex-col gap-4 px-[22px] py-5">
              {fields[kind].map(([label, value, help]) => (
                <div key={label} className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-semibold">{label}</span>
                  <span className="flex min-h-11 items-center overflow-hidden text-ellipsis whitespace-nowrap rounded-[9px] border border-line bg-[#FAFAF8] px-3 font-mono text-[12.5px]">{value}</span>
                  <span className="text-[12.5px] text-muted">{help}</span>
                </div>
              ))}
              {kind === "github" && process.env.GITHUB_APP_SLUG && <a href={`https://github.com/apps/${process.env.GITHUB_APP_SLUG}/installations/new`} className="inline-flex min-h-[42px] items-center self-start rounded-[9px] bg-ink px-4 font-semibold text-white no-underline">Manage on GitHub</a>}
            </div>
          </Card>
          <Card className="min-w-0 flex-[1_1_340px]">
            <CardHead>Recent deliveries</CardHead>
            {log.map((l) => (
              <div key={l.id} className="flex items-center gap-3 border-b border-line-soft px-5 py-[11px] text-[13px]">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${l.ok ? "bg-pass" : "bg-fail"}`} aria-label={l.ok ? "accepted" : "rejected"} />
                <span className="flex min-w-0 flex-1 flex-col"><span className="truncate font-semibold">{l.event}</span><span className="font-mono text-[11.5px] text-muted-2">{l.detail}</span></span>
                <span className="font-mono text-xs text-muted">{timeAgo(l.createdAt)}</span>
              </div>
            ))}
            {log.length === 0 && <p className="m-0 px-5 py-6 text-muted">Nothing delivered yet.</p>}
          </Card>
        </div>
      </Main>
    </>
  );
}
