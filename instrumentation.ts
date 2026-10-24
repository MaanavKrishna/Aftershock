import type { Instrumentation } from "next";

/** Every uncaught server error becomes one structured log line with the request id. */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const { log } = await import("@/lib/obs/log");
  const header = (name: string) => {
    const v = request.headers[name];
    return Array.isArray(v) ? v[0] : v;
  };
  log.error("request failed", {
    requestId: header("x-vercel-id") ?? header("x-request-id"),
    method: request.method,
    path: request.path.split("?")[0],
    route: context.routePath,
    kind: context.routeType,
    digest: typeof err === "object" && err && "digest" in err ? String((err as { digest: unknown }).digest) : undefined,
    err,
  });
};
