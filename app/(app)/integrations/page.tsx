import type { Metadata } from "next";
import Link from "next/link";
import { currentScope } from "@/lib/auth/scope";
import { TopBar, Main, PageTitle } from "@/components/app/TopBar";
import { Card, CardHead } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { timeAgo } from "@/lib/format";
import { AlertForms, ModelForm } from "./forms";
import { flagEnabled } from "@/lib/flags";
import { SOURCES, SOURCE_IDS } from "@/lib/integrations/sources";
import type { IntakeKind } from "@/lib/db/schema";

export const metadata: Metadata = { title: "Integrations" };

const BASE = {
  github: { name: "GitHub App", text: "Repos, issues, checks and bot pull requests.", icon: "M6 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M18 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M6 9v12 M18 15V9a3 3 0 0 0-3-3h-4" },
  model: { name: "Model provider", text: "Drafts tests and triages pull requests. Never decides.", icon: "M12 3l2.5 5.5L20 11l-5.5 2.5L12 19l-2.5-5.5L4 11l5.5-2.5z" },
} as const;
type Kind = keyof typeof BASE | IntakeKind;
const meta = (k: Kind) => (k === "github" || k === "model" ? BASE[k] : { name: SOURCES[k].label, text: SOURCES[k].text, icon: SOURCES[k].icon });

export default async function Integrations({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind: k } = await searchParams;
  const { scope } = await currentScope();
  const [ws, integrations, repos] = await Promise.all([scope.workspace(), scope.integrations(), scope.repos()]);
  const labsOn = flagEnabled("intakeExtra", ws?.settings);
  const visible: Kind[] = ["github", ...SOURCE_IDS.filter((id) => !SOURCES[id].labs || labsOn), "model"];
  const kind: Kind = visible.find((v) => v === k) ?? "github";
  const log = await scope.deliveries(kind);
  const base = process.env.APP_URL ?? "http://127.0.0.1:3000";
  const by = Object.fromEntries(integrations.map((i) => [i.kind, i])) as Partial<Record<Kind, (typeof integrations)[number]>>;
  const isConnected = (id: Kind): boolean => {
    if (id === "github") return Boolean(ws?.installationId) || repos.length > 0;
    if (id === "model") return Boolean(by.model?.enabled) || Boolean(process.env.MODEL_API_KEY);
    const i = by[id];
    return Boolean(i?.enabled && (i.secretCiphertext || i.config.secretHint));
  };
  const modelName = by.model?.config.model ?? process.env.MODEL_NAME ?? "muse-spark-1.3-contributor";
  const stateOf = (id: Kind): string => {
    if (id === "github") return isConnected(id) ? "Installed" : "Not installed";
    if (id === "model") return isConnected(id) ? (by.model?.config.provider === "gateway" ? "AI Gateway" : "Muse Spark") : "Not configured";
    return isConnected(id) ? "Connected" : "Not connected";
  };
  const hint = (id: Kind) => (by[id]?.config.secretHint ? `••••••••••••••••${by[id]?.config.secretHint}` : "Not set");
  const fieldsFor = (id: Kind): [string, string, string][] => {
    if (id === "github") return [["Installation", `${ws?.name} · ${repos.length} repositories`, "Add or remove repositories on GitHub."], ["Permissions", "contents: write (aftershock/* branches only) · issues: read · checks: write · pull_requests: write", "Runner clone tokens are scoped read-only to one repository. Nothing is pushed to a default branch."]];
    if (id === "model") return [["Provider", by.model?.config.provider === "gateway" ? "Vercel AI Gateway" : by.model?.config.provider === "custom" ? "Custom OpenAI-compatible endpoint" : "Muse · OpenAI-compatible", "Or Vercel AI Gateway, or any OpenAI-compatible endpoint."], ["Model", modelName, "Used for drafting tests, triage and postmortem extraction."], ["API key", isConnected("model") ? "•••••••••••••••••••• (server)" : "Not set", "Encrypted at rest. Never sent to a sandbox."]];
    const def = SOURCES[id];
    return [
      ["Webhook URL", `${base}/api/webhooks/${id}?workspace=${ws?.login}`, def.setup],
      [def.auth === "token" ? "Token" : "Signing secret", hint(id), def.auth === "token" ? "Send it as Authorization: Bearer <token>. Deliveries without it are rejected." : "Deliveries without a valid signature are rejected; signed timestamps older than five minutes too."],
      [def.mapping.label, by[id]?.config[def.mapping.key] || "None mapped", "Unmapped alerts go to the repository with the same name, or to your only repository."],
    ];
  };
  return (
    <>
      <TopBar title="Integrations" />
      <Main>
        <PageTitle title="Where incidents come from, and who drafts the tests." sub="Every delivery is verified by signature or token before anything is stored or run." />
        <nav aria-label="Integrations" className="grid grid-cols-[repeat(auto-fit,minmax(min(230px,100%),1fr))] gap-2.5">
          {visible.map((id) => (
            <Link key={id} href={`/integrations?kind=${id}`} aria-current={kind === id ? "page" : undefined} className={`flex min-h-[150px] flex-col items-start gap-2.5 rounded-[14px] bg-card p-[18px] text-inherit no-underline ${kind === id ? "border-2 border-ink" : "border border-line"}`}>
              <span className="flex w-full items-center justify-between gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-[9px] bg-ink text-paper"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={meta(id).icon} /></svg></span>
                <Pill tone={isConnected(id) ? "pass" : "dashed"}>{stateOf(id)}</Pill>
              </span>
              <span className="text-[15px] font-semibold">{meta(id).name}</span>
              <span className="text-[13px] text-muted">{meta(id).text}</span>
            </Link>
          ))}
        </nav>
        {!labsOn && <p className="m-0 text-[13px] text-muted">incident.io, Linear, Rootly, Opsgenie, Datadog, Jira and a generic signed webhook are in <Link href="/settings?tab=labs">Settings → Labs</Link>.</p>}
        <div className="flex flex-wrap items-start gap-4">
          <Card className="min-w-0 flex-[1.5_1_520px]">
            <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-line-soft px-[22px] py-[18px]"><h2 className="m-0 text-lg font-semibold tracking-[-0.015em]">{meta(kind).name}</h2><Pill tone={isConnected(kind) ? "pass" : "dashed"}>{stateOf(kind)}</Pill></div>
            <div className="flex flex-col gap-4 px-[22px] py-5">
              {fieldsFor(kind).map(([label, value, help]) => (
                <div key={label} className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-semibold">{label}</span>
                  <span className="flex min-h-11 items-center overflow-hidden text-ellipsis whitespace-nowrap rounded-[9px] border border-line bg-card-2 px-3 font-mono text-[12.5px]">{value}</span>
                  <span className="text-[12.5px] text-muted">{help}</span>
                </div>
              ))}
              {kind !== "github" && kind !== "model" && <AlertForms kind={kind} label={SOURCES[kind].label} auth={SOURCES[kind].auth} secretFrom={SOURCES[kind].secretFrom} mappingLabel={SOURCES[kind].mapping.label} placeholder={SOURCES[kind].mapping.placeholder} mapping={by[kind]?.config[SOURCES[kind].mapping.key] ?? ""} />}
              {kind === "model" && <ModelForm provider={by.model?.config.provider ?? "muse"} model={by.model?.config.model ?? ""} baseUrl={by.model?.config.baseUrl ?? ""} />}
              {kind === "github" && process.env.GITHUB_APP_SLUG && <a href={`https://github.com/apps/${process.env.GITHUB_APP_SLUG}/installations/new`} className="inline-flex min-h-[42px] items-center self-start rounded-[9px] bg-ink px-4 font-semibold text-paper no-underline">Manage on GitHub</a>}
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
