type Level = "debug" | "info" | "warn" | "error";
type Fields = Record<string, unknown>;

const SECRET = /token|secret|password|authorization|api[-_]?key|apikey|private[-_]?key|cookie/i;
const MAX = 2000;

function clean(key: string, value: unknown, depth = 0): unknown {
  if (SECRET.test(key)) return "[redacted]";
  if (value instanceof Error) return { name: value.name, message: value.message.slice(0, MAX), stack: value.stack?.split("\n").slice(0, 8).join("\n") };
  if (typeof value === "string") return value.length > MAX ? `${value.slice(0, MAX)}…` : value;
  if (value && typeof value === "object" && depth < 3) {
    return Array.isArray(value)
      ? value.slice(0, 50).map((v) => clean("", v, depth + 1))
      : Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clean(k, v, depth + 1)]));
  }
  return value;
}

/** One JSON line per event: Vercel and any log drain can filter on level, requestId, workspaceId, runId. */
export function formatLog(level: Level, msg: string, fields: Fields = {}, now = new Date()): string {
  const safe = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, clean(k, v)]));
  return JSON.stringify({ time: now.toISOString(), level, msg, ...safe });
}

function emit(level: Level, msg: string, fields?: Fields) {
  const line = formatLog(level, msg, fields);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  debug: (msg: string, fields?: Fields) => process.env.AFTERSHOCK_DEBUG === "1" && emit("debug", msg, fields),
  info: (msg: string, fields?: Fields) => emit("info", msg, fields),
  warn: (msg: string, fields?: Fields) => emit("warn", msg, fields),
  error: (msg: string, fields?: Fields) => emit("error", msg, fields),
  /** A logger that adds the same fields (requestId, workspaceId, runId…) to every line. */
  with(base: Fields) {
    return {
      info: (msg: string, f?: Fields) => emit("info", msg, { ...base, ...f }),
      warn: (msg: string, f?: Fields) => emit("warn", msg, { ...base, ...f }),
      error: (msg: string, f?: Fields) => emit("error", msg, { ...base, ...f }),
    };
  },
};

export function requestId(headers: Headers): string {
  return headers.get("x-vercel-id") ?? headers.get("x-request-id") ?? crypto.randomUUID();
}
