/** Timeouts, dropped connections, rate limits and 5xx are worth another try; bad output is not. */
export function isTransientModelError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const status = (err as { status?: number }).status;
  if (status === 429 || (typeof status === "number" && status >= 500)) return true;
  return /APIConnection(Timeout)?Error|RateLimitError|InternalServerError/.test(err.name) || /timed out|ECONNRESET|socket hang up|fetch failed/i.test(err.message);
}

/** Calls the model up to `tries` times, backing off between transient failures. */
export async function withModelRetry<T>(fn: () => Promise<T>, delayMs = 5_000, tries = 3): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i >= tries || !isTransientModelError(err)) throw err;
      await new Promise((r) => setTimeout(r, delayMs * 2 ** (i - 1)));
    }
  }
}
