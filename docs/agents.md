# Coding agents

AI coding agents repeat old mistakes because they never saw the incident. Aftershock gives them that memory two ways: an MCP server they can ask while they work, and a lessons section in `AGENTS.md` they read at the start of every task.

## MCP server

Turn on **MCP server for coding agents** in **Settings → Labs**, then create a **read only** API token in **Settings → API tokens**. The server is at `https://aftershock-mk.vercel.app/api/mcp` (Streamable HTTP, stateless).

| Tool | What it does |
|---|---|
| `check_change` | Pass the files you changed; returns the past incidents whose proven tests cover them, the correct behaviour to keep, and the test that will run on the pull request |
| `list_lessons` | Lessons from production as markdown, optionally for one path |
| `get_incident` | One incident: what happened, the fix, its test, health and Epicenter |
| `list_incidents` | Incidents and their status |
| `run_check` | Re-run a pull request's check (only offered to tokens with write access) |

### Claude Code

```bash
claude mcp add --transport http aftershock https://aftershock-mk.vercel.app/api/mcp --header "Authorization: Bearer as_live_..."
```

### Cursor (`.cursor/mcp.json`)

```json
{ "mcpServers": { "aftershock": { "url": "https://aftershock-mk.vercel.app/api/mcp", "headers": { "Authorization": "Bearer as_live_..." } } } }
```

### VS Code / GitHub Copilot (`.vscode/mcp.json`)

```json
{ "servers": { "aftershock": { "type": "http", "url": "https://aftershock-mk.vercel.app/api/mcp", "headers": { "Authorization": "Bearer ${input:aftershock-token}" } } }, "inputs": [{ "id": "aftershock-token", "type": "promptString", "password": true, "description": "Aftershock API token" }] }
```

A line like this in your agent instructions makes it a habit: *Before committing, call the aftershock `check_change` tool with the files you changed and keep the behaviour it reports.*

## Safety

- Tokens are scoped to one workspace. Read-only tokens can't start anything.
- Requests are rate limited (120 per minute per token) and capped at 64 KB.
- Incident text comes from people and alerts. Agents should treat it as information, not instructions.
