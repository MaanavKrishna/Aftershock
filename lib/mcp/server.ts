import { z } from "zod";
import { TOOLS, type ToolCtx } from "./tools";

export const PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
type Id = string | number | null;
type Message = { jsonrpc?: string; id?: Id; method?: unknown; params?: unknown };
export type Reply = { jsonrpc: "2.0"; id: Id; result?: unknown; error?: { code: number; message: string } };

const err = (id: Id, code: number, message: string): Reply => ({ jsonrpc: "2.0", id, error: { code, message } });
const ok = (id: Id, result: unknown): Reply => ({ jsonrpc: "2.0", id, result });

const visible = (ctx: ToolCtx) => TOOLS.filter((t) => !("write" in t && t.write) || ctx.scope === "write");

/** One JSON-RPC message in, one reply out (null for notifications). Stateless: no sessions are kept. */
export async function handleMessage(raw: unknown, ctx: ToolCtx): Promise<Reply | null> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return err(null, -32600, "Send one JSON-RPC 2.0 request object");
  const m = raw as Message;
  const id = m.id ?? null;
  if (m.jsonrpc !== "2.0" || typeof m.method !== "string") return err(id, -32600, "Invalid JSON-RPC 2.0 request");
  if (m.id === undefined) return null; // notification
  const params = (m.params && typeof m.params === "object" ? m.params : {}) as Record<string, unknown>;
  switch (m.method) {
    case "initialize": {
      const asked = typeof params.protocolVersion === "string" ? params.protocolVersion : "";
      return ok(id, {
        protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "aftershock", title: "Aftershock", version: "0.2.1" },
        instructions: "Aftershock remembers production incidents as proven regression tests. Call check_change with the files you edited before committing, and keep the behaviour it reports.",
      });
    }
    case "ping":
      return ok(id, {});
    case "tools/list":
      return ok(id, {
        tools: visible(ctx).map((t) => ({ name: t.name, title: t.title, description: t.description, inputSchema: z.toJSONSchema(t.input), annotations: { readOnlyHint: t.readOnly, openWorldHint: false } })),
      });
    case "tools/call": {
      const t = visible(ctx).find((x) => x.name === params.name) ?? (ctx.scope !== "write" ? TOOLS.find((x) => x.name === params.name && "write" in x) : undefined);
      if (!t) return err(id, -32602, `Unknown tool: ${String(params.name)}`);
      const parsed = (t.input as z.ZodType).safeParse(params.arguments ?? {});
      if (!parsed.success) return err(id, -32602, `Invalid arguments: ${parsed.error.issues[0]?.message ?? "bad input"}`);
      try {
        const r = await (t.run as (a: unknown, c: ToolCtx) => Promise<{ text: string; data: Record<string, unknown>; isError?: boolean }>)(parsed.data, ctx);
        return ok(id, { content: [{ type: "text", text: r.text }], structuredContent: r.data, isError: Boolean(r.isError) });
      } catch (e) {
        return ok(id, { content: [{ type: "text", text: `Tool failed: ${e instanceof Error ? e.message : String(e)}` }], isError: true });
      }
    }
    default:
      return err(id, -32601, `Method not found: ${m.method}`);
  }
}
