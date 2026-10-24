import type { Metadata } from "next";
import { DsLink } from "@/components/ds/Button";
import { CodeBlock } from "@/components/ds/CodeBlock";
import { Band, SectionHead } from "@/components/site/Section";

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
      <section className="mx-auto max-w-[1240px] px-4 pb-14 pt-16 sm:px-6 sm:pt-20">
        <h1 className="m-0 max-w-[20ch] text-balance font-display text-d1 font-semibold tracking-[-0.03em] text-fg">Coding agents that remember your outages.</h1>
        <p className="mt-6 max-w-[60ch] text-lede text-fg-2">Agents write more of the code every month, and they never saw last quarter’s incident. Aftershock gives them that memory before they commit, and its checks catch them if they forget.</p>
      </section>
      <Band tone="raised">
        <SectionHead title="Five tools over MCP" lede="A stateless MCP server over Streamable HTTP. Use a read-only token; it can look things up but never start anything." />
        <dl className="m-0 grid gap-x-12 gap-y-6 md:grid-cols-2">
          {TOOLS.map(([t, d]) => (
            <div key={t} className="flex flex-col gap-1 border-t border-rule pt-4">
              <dt className="font-code text-[14.5px] text-fg">{t}</dt>
              <dd className="m-0 text-[15px] text-fg-2">{d}</dd>
            </div>
          ))}
        </dl>
      </Band>
      <Band>
        <SectionHead title="Set it up in your editor" lede="Turn on the MCP server in Settings → Labs, create a read-only token in Settings → API tokens, then add it to your tool." />
        <div className="grid gap-6 lg:grid-cols-3">
          {SETUPS.map(([name, file, code]) => (
            <div key={name} className="flex min-w-0 flex-col gap-3">
              <h3 className="m-0 text-[17px] font-semibold text-fg">{name}</h3>
              <CodeBlock code={code} file={file} />
            </div>
          ))}
        </div>
      </Band>
      <Band tone="raised">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <SectionHead title="Lessons in AGENTS.md" lede="Codex, Cursor, Copilot and Claude Code read AGENTS.md before they start. One click opens a pull request that writes your proven lessons into a marked section; the rest of the file stays yours." />
          <CodeBlock file="AGENTS.md" copy={false} code={`<!-- aftershock:lessons:start -->
## Lessons from production (Aftershock)
### INC-12 · app/services/payment_service.py
Payment retry charged a customer twice.
Expected: one order, one charge; the retry is rejected with 400
Test: tests/aftershock/test_inc_12_payment_retry.py
<!-- aftershock:lessons:end -->`} />
        </div>
        <div className="mt-2 flex flex-wrap gap-3"><DsLink href="/signin">Install on GitHub</DsLink><DsLink href="/docs/agents" variant="secondary">Agent docs</DsLink></div>
      </Band>
    </>
  );
}
