import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { Band, PageHero, SectionHead } from "@/components/site/Section";

export const metadata: Metadata = { title: "Coding agents", description: "Give Claude Code, Cursor and Copilot your incident memory over MCP and AGENTS.md.", alternates: { canonical: "/agents" } };

const SETUPS: [string, string, string][] = [
  ["Claude Code", "terminal", `claude mcp add --transport http aftershock https://aftershock-mk.vercel.app/api/mcp \\
  --header "Authorization: Bearer as_live_..."`],
  ["Cursor", ".cursor/mcp.json", `{ "mcpServers": { "aftershock": {
  "url": "https://aftershock-mk.vercel.app/api/mcp",
  "headers": { "Authorization": "Bearer as_live_..." } } } }`],
  ["VS Code and Copilot", ".vscode/mcp.json", `{ "servers": { "aftershock": { "type": "http",
  "url": "https://aftershock-mk.vercel.app/api/mcp",
  "headers": { "Authorization": "Bearer \${input:aftershock-token}" } } },
  "inputs": [{ "id": "aftershock-token", "type": "promptString", "password": true }] }`],
];

const TOOLS: [string, string][] = [
  ["check_change", "Pass the files you changed. Get the past incidents those files caused, the behaviour to keep, and the test that will run."],
  ["ask", "Ask about past incidents in plain language. Answers cite incident keys and nothing else."],
  ["list_lessons", "Lessons from production as markdown, for one path or the whole repository."],
  ["get_incident, list_incidents", "What happened, the fix, its proven tests and where it began."],
  ["run_check", "Re-run a pull request’s check. Offered only to tokens with write access."],
];

export default function Agents() {
  return (
    <>
      <PageHero eyebrow="Coding agents" title="Coding agents that remember your outages." lede="Agents write more of the code every month, and they never saw last quarter’s incident. Aftershock gives them that memory before they commit, and its checks catch them if they forget.">
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/signin" size="lg">Install on GitHub</ButtonLink>
          <ButtonLink href="/docs/agents" size="lg" variant="secondary">Agent docs</ButtonLink>
        </div>
      </PageHero>
      <Band tone="s1" labelledBy="tools-h">
        <SectionHead id="tools-h" title="Five tools over MCP" lede="A stateless MCP server over Streamable HTTP. Use a read-only token; it can look things up but never start anything." />
        <dl className="m-0 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map(([t, d]) => (
            <div key={t} className="flex flex-col gap-2 rounded-card border border-border bg-canvas p-5">
              <dt className="font-mono text-ui text-fg">{t}</dt>
              <dd className="m-0 text-body text-fg-2">{d}</dd>
            </div>
          ))}
        </dl>
      </Band>
      <Band labelledBy="setup-h">
        <SectionHead id="setup-h" title="Set it up in your editor" lede="Turn on the MCP server in Settings → Labs, create a read-only token in Settings → API tokens, then add it to your tool." />
        <div className="grid gap-6 lg:grid-cols-3">
          {SETUPS.map(([name, file, code]) => (
            <div key={name} className="flex min-w-0 flex-col gap-3">
              <h3 className="m-0 text-title-3 font-semibold text-fg">{name}</h3>
              <CodeBlock code={code} file={file} />
            </div>
          ))}
        </div>
      </Band>
      <Band tone="s1" labelledBy="lessons-h">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div className="flex flex-col">
            <SectionHead id="lessons-h" title="Lessons in AGENTS.md" lede="Codex, Cursor, Copilot and Claude Code read AGENTS.md before they start. One click opens a pull request that writes your proven lessons into a marked section; the rest of the file stays yours." className="lg:mb-8" />
            <div className="flex flex-wrap gap-3"><ButtonLink href="/signin" size="lg">Install on GitHub</ButtonLink><ButtonLink href="/docs/agents" size="lg" variant="secondary">Agent docs</ButtonLink></div>
          </div>
          <div className="min-w-0">
            <CodeBlock file="AGENTS.md" copy={false} code={`<!-- aftershock:lessons:start -->
## Lessons from production (Aftershock)
### INC-12 · app/services/payment_service.py
Payment retry charged a customer twice.
Expected: one order, one charge; the retry is rejected with 400
Test: tests/aftershock/test_inc_12_payment_retry.py
<!-- aftershock:lessons:end -->`} />
          </div>
        </div>
      </Band>
    </>
  );
}
