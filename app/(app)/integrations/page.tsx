import type { Metadata } from "next";
import Link from "next/link";
import { currentScope } from "@/lib/auth/scope";
import { TopBar, Main } from "@/components/app/TopBar";
import { Card, CardHead } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { CopyText } from "@/components/ui/CopyText";
import { Badge, PageHeader } from "@/components/ui/Feedback";
import { Verdict } from "@/components/ui/Verdict";
import { External } from "@/components/ui/icons";
import { timeAgo } from "@/lib/format";
import { AlertForms, ModelForm } from "./forms";
import { flagEnabled } from "@/lib/flags";
import { SOURCES, SOURCE_IDS } from "@/lib/integrations/sources";
import type { IntakeKind } from "@/lib/db/schema";

export const metadata: Metadata = { title: "Integrations" };

const BASE = {
  github: {
    name: "GitHub App",
    text: "Repos, issues, checks and bot pull requests.",
    icon: "M6 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M18 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M6 9v12 M18 15V9a3 3 0 0 0-3-3h-4",
  },
  model: {
    name: "Model provider",
    text: "Drafts tests and triages pull requests. Never decides.",
    icon: "M12 3l2.5 5.5L20 11l-5.5 2.5L12 19l-2.5-5.5L4 11l5.5-2.5z",
  },
} as const;
type Kind = keyof typeof BASE | IntakeKind;
const meta = (k: Kind) =>
  k === "github" || k === "model"
    ? BASE[k]
    : { name: SOURCES[k].label, text: SOURCES[k].text, icon: SOURCES[k].icon };

function Icon({ d }: { d: string }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control border border-border bg-s2 text-fg-2">
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={d} />
      </svg>
    </span>
  );
}

function State({ on, label }: { on: boolean; label: string }) {
  return on ? (
    <Verdict kind="healthy" label={label} size="sm" />
  ) : (
    <Badge tone="outline">{label}</Badge>
  );
}

export default async function Integrations({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const { kind: k } = await searchParams;
  const { scope } = await currentScope();
  const [ws, integrations, repos] = await Promise.all([
    scope.workspace(),
    scope.integrations(),
    scope.repos(),
  ]);
  const labsOn = flagEnabled("intakeExtra", ws?.settings);
  const visible: Kind[] = [
    "github",
    ...SOURCE_IDS.filter((id) => !SOURCES[id].labs || labsOn),
    "model",
  ];
  const kind: Kind = visible.find((v) => v === k) ?? "github";
  const log = await scope.deliveries(kind);
  const base = process.env.APP_URL ?? "http://127.0.0.1:3000";
  const by = Object.fromEntries(
    integrations.map((i) => [i.kind, i]),
  ) as Partial<Record<Kind, (typeof integrations)[number]>>;
  const isConnected = (id: Kind): boolean => {
    if (id === "github") return Boolean(ws?.installationId) || repos.length > 0;
    if (id === "model")
      return Boolean(by.model?.enabled) || Boolean(process.env.MODEL_API_KEY);
    const i = by[id];
    return Boolean(i?.enabled && (i.secretCiphertext || i.config.secretHint));
  };
  const modelName =
    by.model?.config.model ??
    process.env.MODEL_NAME ??
    "muse-spark-1.3-contributor";
  const stateOf = (id: Kind): string => {
    if (id === "github") return isConnected(id) ? "Installed" : "Not installed";
    if (id === "model")
      return isConnected(id)
        ? by.model?.config.provider === "gateway"
          ? "AI Gateway"
          : "Muse Spark"
        : "Not configured";
    return isConnected(id) ? "Connected" : "Not connected";
  };
  const hint = (id: Kind) =>
    by[id]?.config.secretHint
      ? `••••••••••••••••${by[id]?.config.secretHint}`
      : "Not set";
  /** Read-only facts about the selected integration: label, value, help, and whether the value is worth copying. */
  const fieldsFor = (id: Kind): [string, string, string, boolean][] => {
    if (id === "github")
      return [
        [
          "Installation",
          `${ws?.name} · ${repos.length} repositories`,
          "Add or remove repositories on GitHub.",
          false,
        ],
        [
          "Permissions",
          "contents: write (aftershock/* branches only) · issues: read · checks: write · pull_requests: write",
          "Runner clone tokens are scoped read-only to one repository. Nothing is pushed to a default branch.",
          false,
        ],
      ];
    if (id === "model") return []; // the model form below shows provider, model and key
    const def = SOURCES[id];
    return [
      [
        "Webhook URL",
        `${base}/api/webhooks/${id}?workspace=${ws?.login}`,
        def.setup,
        true,
      ],
      [
        def.auth === "token" ? "Token" : "Signing secret",
        hint(id),
        def.auth === "token"
          ? "Send it as Authorization: Bearer <token>. Deliveries without it are rejected."
          : "Deliveries without a valid signature are rejected; signed timestamps older than five minutes too.",
        false,
      ],
    ];
  };
  const appUrl = process.env.GITHUB_APP_SLUG
    ? `https://github.com/apps/${process.env.GITHUB_APP_SLUG}/installations/new`
    : null;
  return (
    <>
      <TopBar title="Integrations" />
      <Main>
        <PageHeader
          title="Where incidents come from, and who drafts the tests."
          sub="Every delivery is verified by signature or token before anything is stored or run."
        />
        <nav
          aria-label="Integrations"
          className="grid grid-cols-[repeat(auto-fill,minmax(min(220px,100%),1fr))] gap-3"
        >
          {visible.map((id) => {
            const on = kind === id;
            return (
              <Link
                key={id}
                href={`/integrations?kind=${id}`}
                aria-current={on ? "page" : undefined}
                className={`flex flex-col items-start gap-3 rounded-card sm:min-h-36 border bg-s1 p-4 no-underline shadow-e1 transition-[border-color,background-color] duration-150 ease-fl ${on ? "border-signal ring-1 ring-signal" : "border-border hover:border-border-strong hover:bg-s2"}`}
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <Icon d={meta(id).icon} />
                  <State on={isConnected(id)} label={stateOf(id)} />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-ui font-semibold text-fg">
                    {meta(id).name}
                  </span>
                  <span className="text-callout text-fg-3">
                    {meta(id).text}
                  </span>
                </span>
              </Link>
            );
          })}
        </nav>
        {!labsOn && (
          <p className="m-0 text-callout text-fg-3">
            incident.io, Linear, Rootly, Opsgenie, Datadog, Jira and a generic
            signed webhook are in{" "}
            <Link
              href="/settings?tab=labs"
              className="font-medium text-signal underline underline-offset-2"
            >
              Settings → Labs
            </Link>
            .
          </p>
        )}
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-soft px-5 py-4">
              <span className="flex min-w-0 items-center gap-3">
                <Icon d={meta(kind).icon} />
                <span className="flex min-w-0 flex-col">
                  <h2 className="m-0 text-title-3 font-semibold text-fg">{meta(kind).name}</h2>
                  {kind === "model" && <span className="truncate font-mono text-caption text-fg-3">{modelName}</span>}
                </span>
              </span>
              <State on={isConnected(kind)} label={stateOf(kind)} />
            </div>
            {fieldsFor(kind).length > 0 && (
              <dl className="m-0 flex flex-col gap-4 px-5 py-5">
                {fieldsFor(kind).map(([label, value, help, copy]) => (
                  <div key={label} className="flex min-w-0 flex-col gap-1.5">
                    <dt className="text-callout font-medium text-fg">
                      {label}
                    </dt>
                    <dd className="m-0 flex min-w-0 items-center gap-2">
                      <span className="flex min-h-10 min-w-0 flex-1 items-center truncate rounded-control border border-border bg-s2 px-3 font-mono text-callout text-fg-2">
                        {value}
                      </span>
                      {copy && <CopyText text={value} />}
                    </dd>
                    <dd className="m-0 text-caption text-fg-3">{help}</dd>
                  </div>
                ))}
              </dl>
            )}
            {kind !== "github" && (
              <div
                className={`px-5 py-5 ${kind === "model" ? "" : "border-t border-border-soft"}`}
              >
                {kind === "model" ? (
                  <ModelForm
                    provider={by.model?.config.provider ?? "muse"}
                    model={by.model?.config.model ?? ""}
                    baseUrl={by.model?.config.baseUrl ?? ""}
                  />
                ) : (
                  <AlertForms
                    kind={kind}
                    label={SOURCES[kind].label}
                    auth={SOURCES[kind].auth}
                    secretFrom={SOURCES[kind].secretFrom}
                    mappingLabel={SOURCES[kind].mapping.label}
                    placeholder={SOURCES[kind].mapping.placeholder}
                    mapping={by[kind]?.config[SOURCES[kind].mapping.key] ?? ""}
                  />
                )}
              </div>
            )}
            {kind === "github" && appUrl && (
              <div className="border-t border-border-soft px-5 py-4">
                <ButtonLink href={appUrl}>
                  Manage on GitHub
                  <External size={14} />
                </ButtonLink>
              </div>
            )}
          </Card>
          <Card>
            <CardHead sub={`${meta(kind).name}, newest first`}>
              Recent deliveries
            </CardHead>
            {log.length === 0 ? (
              <p className="m-0 px-5 py-8 text-center text-ui text-fg-3">
                Nothing delivered yet.
              </p>
            ) : (
              <ul className="m-0 list-none p-0">
                {log.map((l) => (
                  <li
                    key={l.id}
                    className="flex items-center gap-3 border-b border-border-soft px-5 py-3 last:border-b-0"
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-ui font-medium text-fg">
                        {l.event}
                      </span>
                      <span className="truncate font-mono text-caption text-fg-3">
                        {l.detail}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <Verdict
                        kind={l.ok ? "healthy" : "failing"}
                        label={l.ok ? "Accepted" : "Rejected"}
                        size="sm"
                      />
                      <span className="text-caption tabular-nums text-fg-3">
                        {timeAgo(l.createdAt)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </Main>
    </>
  );
}
