import { buttonClass } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Feedback";
import { FormMessage, inputClass } from "@/components/ui/Field";
import { TokenForm } from "@/app/(app)/settings/forms";
import { changeMember, revokeOtherSessionsAction, revokeSessionAction, revokeToken } from "@/app/(app)/actions";
import { timeAgo } from "@/lib/format";
import { Section, device, type Rows } from "./Section";

export function MembersTab({ members, owner, me, error }: { members: Rows<"members">; owner: boolean; me: string; error?: string }) {
  return (
    <Section title="Team" sub="Members come from your GitHub organisation. Roles control who can override checks.">
      {error && (
        <div className="border-b border-border-soft bg-recur-soft px-5 py-3 sm:px-6">
          <FormMessage error={error} />
        </div>
      )}
      <ul className="m-0 list-none p-0">
        {members.map(({ user, role }) => (
          <li key={user.id} role="group" aria-label={`${user.login} (${role})`} className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-border-soft px-5 py-3.5 last:border-b-0 sm:px-6">
            <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-s2 text-callout font-semibold text-fg-2">
              {(user.name ?? user.login)[0].toUpperCase()}
            </span>
            <span className="flex min-w-0 flex-[1_1_180px] flex-col">
              <span className="truncate text-ui font-medium text-fg">
                {user.name ?? user.login}
                {user.id === me && <span className="font-normal text-fg-3"> (you)</span>}
              </span>
              <span className="truncate font-mono text-caption text-fg-3">@{user.login}</span>
            </span>
            {owner ? (
              <form action={changeMember} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="userId" value={user.id} />
                <select name="role" aria-label="Role" defaultValue={role} className={`${inputClass} min-h-8 w-auto px-2 text-callout`}>
                  <option value="owner">Owner</option>
                  <option value="admin">Admin</option>
                  <option value="member">Member</option>
                  <option value="remove">Remove from workspace</option>
                </select>
                <button type="submit" className={buttonClass("secondary", "sm")}>
                  Update role
                </button>
              </form>
            ) : (
              <Badge>{role[0].toUpperCase() + role.slice(1)}</Badge>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function TokensTab({ tokens }: { tokens: Rows<"tokens"> }) {
  return (
    <Section title="API tokens" sub="For the CLI, the GitHub Action and the HTTP API.">
      <TokenForm />
      {tokens.length === 0 ? (
        <p className="m-0 px-5 py-6 text-ui text-fg-3 sm:px-6">No tokens yet.</p>
      ) : (
        <ul className="m-0 list-none p-0">
          {tokens.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border-soft px-5 py-3.5 last:border-b-0 sm:px-6">
              <span className="flex min-w-0 flex-[1_1_200px] flex-col">
                <span className="truncate text-ui font-medium text-fg">{t.name}</span>
                <span className="font-mono text-caption text-fg-3">
                  {t.prefix} · {t.scope === "read" ? "read only" : "read and write"}
                </span>
              </span>
              <span className="text-caption text-fg-3">{t.lastUsedAt ? `Used ${timeAgo(t.lastUsedAt).toLowerCase()}` : "Never used"}</span>
              <form action={revokeToken}>
                <input type="hidden" name="tokenId" value={t.id} />
                <button type="submit" aria-label={`Revoke ${t.name}`} className={buttonClass("dangerOutline", "sm")}>
                  Revoke
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

type SessionRow = { id: string; userAgent: string; createdAt: Date; lastSeenAt: Date };

export function SessionsTab({ sessions, current }: { sessions: SessionRow[]; current: string }) {
  return (
    <Section
      title="Sessions"
      sub="Where you are signed in. A session ends after 14 days without use, and after 30 days at most."
      aside={
        sessions.length > 1 && (
          <form action={revokeOtherSessionsAction}>
            <button type="submit" className={buttonClass("secondary", "sm")}>
              Sign out everywhere else
            </button>
          </form>
        )
      }
    >
      <ul className="m-0 list-none p-0">
        {sessions.map((x) => (
          <li key={x.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border-soft px-5 py-3.5 last:border-b-0 sm:px-6">
            <span className="flex min-w-0 flex-[1_1_240px] flex-col gap-0.5">
              <span className="flex flex-wrap items-center gap-2 text-ui font-medium text-fg">
                {device(x.userAgent)}
                {x.id === current && <Badge tone="outline">This browser</Badge>}
              </span>
              <span className="text-caption text-fg-3">
                Signed in {timeAgo(x.createdAt).toLowerCase()} · last used {timeAgo(x.lastSeenAt).toLowerCase()}
              </span>
            </span>
            {x.id !== current && (
              <form action={revokeSessionAction}>
                <input type="hidden" name="sid" value={x.id} />
                <button type="submit" aria-label={`Sign out ${device(x.userAgent)}`} className={buttonClass("dangerOutline", "sm")}>
                  Sign out
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}
