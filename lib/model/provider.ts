export type ModelConfig = { provider: "muse" | "gateway" | "custom"; baseURL: string; apiKey: string; model: string };
export type Message = { role: "system" | "user"; content: string };
export type Completion = { text: string; tokens?: number; model: string };
type Client = (cfg: ModelConfig, messages: Message[]) => Promise<Completion>;

const GATEWAY = "https://ai-gateway.vercel.sh/v1";
const MUSE_DEFAULT_URL = "https://api.meta.ai/v1";
const MUSE_DEFAULT_MODEL = "muse-spark-1.3-contributor";

/** Custom endpoints must be public https hosts: never loopback, private, link-local or internal names. */
export function isPublicHttpsUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".internal") || h.endsWith(".local")) return false;
  if (h.includes(":")) return !(h === "::1" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80") || h === "::");
  const ip = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ip) {
    const [a, b] = [Number(ip[1]), Number(ip[2])];
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)) return false;
  }
  return true;
}

/** Workspace setting first, then the server's environment. Null means no model is available. */
export function resolveModelConfig(stored: { config: Record<string, string>; apiKey?: string } | null, env: Record<string, string | undefined>): ModelConfig | null {
  const provider = (stored?.config.provider as ModelConfig["provider"]) ?? "muse";
  if (provider === "gateway") {
    const apiKey = stored?.apiKey ?? env.AI_GATEWAY_API_KEY;
    const model = stored?.config.model || env.AI_GATEWAY_MODEL;
    return apiKey && model ? { provider, baseURL: GATEWAY, apiKey, model } : null;
  }
  if (provider === "custom") {
    const apiKey = stored?.apiKey;
    const baseURL = stored?.config.baseUrl;
    const model = stored?.config.model;
    return apiKey && baseURL && model && isPublicHttpsUrl(baseURL) ? { provider, baseURL, apiKey, model } : null;
  }
  const apiKey = stored?.apiKey ?? env.MODEL_API_KEY;
  if (!apiKey) return null;
  return { provider: "muse", baseURL: env.MODEL_BASE_URL || MUSE_DEFAULT_URL, apiKey, model: stored?.config.model || env.MODEL_NAME || MUSE_DEFAULT_MODEL };
}

let override: Client | null = null;
/** Tests replace the network client. */
export function setModelClient(c: Client | null) {
  override = c;
}

const openaiClient: Client = async (cfg, messages) => {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: cfg.apiKey, baseURL: cfg.baseURL, timeout: 90_000, maxRetries: 0 }); // callers retry transient failures (lib/model/retry.ts)
  const res = await client.chat.completions.create({ model: cfg.model, messages, temperature: 0.2 });
  return { text: res.choices[0]?.message?.content ?? "", tokens: res.usage?.total_tokens, model: cfg.model };
};

export async function workspaceModel(workspaceId: string): Promise<ModelConfig | null> {
  if (override) return { provider: "muse", baseURL: "test", apiKey: "test", model: "test-model" };
  const { and, eq } = await import("drizzle-orm");
  const { getDb } = await import("@/lib/db/client");
  const s = await import("@/lib/db/schema");
  const { decrypt } = await import("@/lib/crypto");
  const db = await getDb();
  const [row] = await db.select().from(s.integrations).where(and(eq(s.integrations.workspaceId, workspaceId), eq(s.integrations.kind, "model")));
  const stored = row ? { config: row.config, apiKey: row.secretCiphertext ? decrypt(row.secretCiphertext) : undefined } : null;
  return resolveModelConfig(stored, process.env);
}

export async function complete(workspaceId: string, messages: Message[]): Promise<Completion> {
  const cfg = await workspaceModel(workspaceId);
  if (!cfg) throw new Error("No model is configured. Connect one in Integrations, or set MODEL_API_KEY on the server.");
  return (override ?? openaiClient)(cfg, messages);
}
