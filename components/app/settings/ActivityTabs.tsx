import Link from "next/link";
import { ButtonLink, buttonClass } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Feedback";
import { THead, Th, Tr, Td } from "@/components/ui/Table";
import { Verdict } from "@/components/ui/Verdict";
import { ConfirmDelete } from "@/components/app/ConfirmDelete";
import {
  AddTargetForm,
  TestTargetButton,
} from "@/app/(app)/settings/notifyForms";
import { updateTarget } from "@/app/(app)/settings/notifyActions";
import {
  deleteAccountAction,
  deleteWorkspaceAction,
} from "@/app/(app)/actions";
import { NOTIFY_EVENTS, NOTIFY_EVENT_IDS } from "@/lib/notify/format";
import { timeAgo } from "@/lib/format";
import { Note, Row, Section, type Rows } from "./Section";

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export function NotificationsTab({
  enabled,
  admin,
  targets,
  sent,
}: {
  enabled: boolean;
  admin: boolean;
  targets: Rows<"notificationTargets">;
  sent: Rows<"notificationLog">;
}) {
  return (
    <Section
      title="Notifications"
      sub="Send proofs, blocked pull requests and failing memory tests to Slack or any signed webhook."
    >
      {!enabled ? (
        <Note>
          Notifications are in Labs.{" "}
          <Link
            href="/settings?tab=labs"
            className="font-medium text-signal underline underline-offset-2"
          >
            Turn them on
          </Link>{" "}
          to add targets.
        </Note>
      ) : !admin ? (
        <Note>Only owners and admins can manage notification targets.</Note>
      ) : (
        <>
          <AddTargetForm
            events={NOTIFY_EVENT_IDS.map((e) => [e, NOTIFY_EVENTS[e]])}
          />
          {targets.length === 0 && <Note>No targets yet.</Note>}
          <ul className="m-0 list-none p-0">
            {targets.map((t) => (
              <li
                key={t.id}
                className="flex flex-col gap-3 border-b border-border-soft px-5 py-4 sm:px-6"
              >
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <span className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5">
                    <span className="flex flex-wrap items-center gap-2 text-ui font-medium text-fg">
                      {t.name}
                      <span className="font-normal text-fg-3">
                        · {t.kind === "slack" ? "Slack" : "Signed webhook"}
                      </span>
                      {t.enabled ? (
                        <Verdict kind="healthy" label="On" size="sm" />
                      ) : (
                        <Badge tone="outline">Off</Badge>
                      )}
                    </span>
                    <span className="truncate font-mono text-caption text-fg-3">
                      {t.urlHint}
                    </span>
                    {t.enabled && (
                      <span className="text-caption text-fg-3">
                        {t.lastDeliveryAt
                          ? `Last ${t.lastStatus} ${timeAgo(t.lastDeliveryAt).toLowerCase()}`
                          : "Nothing sent yet"}
                      </span>
                    )}
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <TestTargetButton targetId={t.id} />
                    <form action={updateTarget}>
                      <input type="hidden" name="targetId" value={t.id} />
                      <input
                        type="hidden"
                        name="op"
                        value={t.enabled ? "disable" : "enable"}
                      />
                      <button
                        type="submit"
                        className={buttonClass("secondary", "sm")}
                      >
                        {t.enabled ? "Turn off" : "Turn on"}
                      </button>
                    </form>
                    <form action={updateTarget}>
                      <input type="hidden" name="targetId" value={t.id} />
                      <input type="hidden" name="op" value="remove" />
                      <button
                        type="submit"
                        aria-label={`Remove ${t.name}`}
                        className={buttonClass("dangerOutline", "sm")}
                      >
                        Remove
                      </button>
                    </form>
                  </div>
                </div>
                {t.disabledReason && (
                  <p className="m-0 text-callout font-medium text-recur">
                    {t.disabledReason}
                  </p>
                )}
                <form
                  action={updateTarget}
                  className="flex flex-col gap-2 rounded-control bg-s2 px-3.5 py-3"
                >
                  <input type="hidden" name="targetId" value={t.id} />
                  <input type="hidden" name="op" value="events" />
                  <fieldset className="m-0 flex flex-wrap gap-x-4 gap-y-0.5 border-0 p-0">
                    <legend className="sr-only">Events for {t.name}</legend>
                    {NOTIFY_EVENT_IDS.map((e) => (
                      <label
                        key={e}
                        className="flex min-h-8 cursor-pointer items-center gap-2 text-caption text-fg-2"
                      >
                        <input
                          type="checkbox"
                          name="events"
                          value={e}
                          defaultChecked={t.events.includes(e)}
                          className="h-4 w-4 cursor-pointer accent-signal"
                        />
                        {NOTIFY_EVENTS[e]}
                      </label>
                    ))}
                  </fieldset>
                  <div>
                    <button
                      type="submit"
                      className={buttonClass("secondary", "sm")}
                    >
                      Save events
                    </button>
                  </div>
                </form>
              </li>
            ))}
          </ul>
          {sent.length > 0 && (
            <div className="flex flex-col border-t border-border-soft">
              <h3 className="m-0 px-5 pb-1 pt-4 text-callout font-medium text-fg-3 sm:px-6">
                Recent deliveries
              </h3>
              <ul className="m-0 list-none p-0">
                {sent.map((n) => (
                  <li
                    key={n.id}
                    className="flex items-center gap-3 border-b border-border-soft px-5 py-2.5 last:border-b-0 sm:px-6"
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-ui font-medium text-fg">
                        {n.title}
                      </span>
                      <span className="truncate font-mono text-caption text-fg-3">
                        {n.target}
                        {n.attempts > 1
                          ? ` · after ${n.attempts} attempts`
                          : ""}
                        {n.lastError ? ` · ${n.lastError}` : ""}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <Verdict
                        kind={
                          n.status === "sent"
                            ? "healthy"
                            : n.status === "failed"
                              ? "failing"
                              : "skipped"
                        }
                        label={cap(n.status)}
                        size="sm"
                      />
                      <span className="text-caption tabular-nums text-fg-3">
                        {timeAgo(n.createdAt)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </Section>
  );
}

export function AuditTab({
  admin,
  audit,
}: {
  admin: boolean;
  audit: Rows<"auditLog">;
}) {
  return (
    <Section
      title="Audit log"
      sub="Deletions, role changes and removals in this workspace. Kept after the workspace is deleted."
    >
      {!admin ? (
        <Note>Only owners and admins can see the audit log.</Note>
      ) : audit.length === 0 ? (
        <Note>Nothing has been changed yet.</Note>
      ) : (
        <div
          role="region"
          aria-label="Audit log entries"
          tabIndex={0}
          className="overflow-x-auto"
        >
          <table className="w-full border-collapse text-left text-ui tabular-nums">
            <THead>
              <tr>
                <Th className="pl-5 sm:pl-6">When</Th>
                <Th>Who</Th>
                <Th>Action</Th>
                <Th className="pr-5 sm:pr-6">Target</Th>
              </tr>
            </THead>
            <tbody>
              {audit.map((a) => (
                <Tr key={a.id}>
                  <Td className="whitespace-nowrap pl-5 text-fg-3 sm:pl-6">
                    {timeAgo(a.createdAt)}
                  </Td>
                  <Td className="whitespace-nowrap text-fg">
                    {a.actor ?? "Aftershock"}
                  </Td>
                  <Td className="whitespace-nowrap font-mono text-callout text-fg">
                    {a.action}
                  </Td>
                  <Td className="min-w-[220px] pr-5 sm:pr-6">
                    {a.target}
                    {a.detail ? (
                      <span className="text-fg-3"> · {a.detail}</span>
                    ) : null}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

export function DangerTab({ login, owner }: { login: string; owner: boolean }) {
  return (
    <Section
      title="Danger zone"
      sub="Tests already merged into your repositories stay there."
      tone="danger"
    >
      <Row
        title="Export everything"
        sub="Incidents, evidence and run history as JSON."
      >
        <ButtonLink href="/api/v1/export" variant="secondary">
          Download export
        </ButtonLink>
      </Row>
      <Row
        title="Delete workspace"
        sub={`Removes every incident, proof, check and setting in ${login}. Owners only. This cannot be undone.`}
        stack
      >
        {owner ? (
          <ConfirmDelete
            action={deleteWorkspaceAction}
            fields={{}}
            expected={login}
            button="Delete workspace"
            description="Everything in this workspace is deleted immediately. The GitHub App stays installed until you uninstall it on GitHub."
          />
        ) : (
          <span className="text-callout text-fg-3">Ask an owner.</span>
        )}
      </Row>
      <Row
        title="Delete your account"
        sub="Removes you from every workspace. Workspaces where you are the only member are deleted with it."
        stack
      >
        <ConfirmDelete
          action={deleteAccountAction}
          fields={{}}
          expected="delete my account"
          button="Delete your account"
          description="Your notes and overrides stay on their incidents without your name."
        />
      </Row>
    </Section>
  );
}
