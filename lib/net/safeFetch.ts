import { request } from "node:https";
import { lookup as dnsLookup, promises as dnsPromises, type LookupAddress } from "node:dns";
import { isIP } from "node:net";

const v4 = (ip: string) => ip.split(".").map(Number);

function privateV4(ip: string): boolean {
  const [a, b, c] = v4(ip);
  return (
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113)
  );
}

/** Loopback, private, link-local, CGNAT, multicast, documentation and cloud-metadata ranges, IPv4 and IPv6. */
export function isPrivateAddress(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return privateV4(ip);
  if (kind !== 6) return true;
  const h = ip.toLowerCase();
  const mapped = h.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return privateV4(mapped[1]);
  if (h === "::" || h === "::1") return true;
  if (/^::ffff:/.test(h) || h.startsWith("64:ff9b:")) return true; // hex-form mapped or NAT64: refuse rather than decode
  const first = parseInt(h.split(":")[0] || "0", 16);
  return (first & 0xfe00) === 0xfc00 || (first & 0xffc0) === 0xfe80 || (first & 0xff00) === 0xff00 || h.startsWith("2001:db8:");
}

/** Null when the URL may receive notifications, otherwise why not. DNS is checked again at connect time. */
export function checkTargetUrl(raw: string, kind: "slack" | "webhook"): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return "Enter a valid URL.";
  }
  if (u.protocol !== "https:") return "The URL must start with https://.";
  if (u.username || u.password) return "Remove credentials from the URL.";
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (kind === "slack") return host === "hooks.slack.com" && u.pathname.startsWith("/services/") ? null : "Use a Slack incoming webhook URL (https://hooks.slack.com/services/…).";
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) return "Addresses that are private or internal are not allowed.";
  if (isIP(host) && isPrivateAddress(host)) return "Addresses that are private or internal are not allowed.";
  return null;
}

type LookupCb = (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void;

/** DNS lookup that refuses private answers, so a public name can't be re-pointed at an internal address. */
function safeLookup(hostname: string, options: { all?: boolean }, cb: LookupCb): void {
  dnsLookup(hostname, { all: true }, (err, addresses) => {
    if (err) return cb(err, "");
    const bad = addresses.find((a) => isPrivateAddress(a.address));
    if (bad || addresses.length === 0) return cb(Object.assign(new Error(`Refused: ${hostname} resolves to a private address`), { code: "EPRIVATE" }), "");
    if (options.all) return cb(null, addresses);
    cb(null, addresses[0].address, addresses[0].family);
  });
}

/** POSTs a body over https with the SSRF guard, a hard timeout and no redirects. Resolves with the status code. */
export function postJson(url: string, body: string, headers: Record<string, string>, timeoutMs = 5000): Promise<{ status: number }> {
  return new Promise((resolve, reject) => {
    let u: URL;
    try {
      u = new URL(url);
    } catch {
      return reject(new Error("Invalid URL"));
    }
    const host = u.hostname.replace(/^\[|\]$/g, "");
    if (u.protocol !== "https:") return reject(new Error("Only https is allowed"));
    if (isIP(host) && isPrivateAddress(host)) return reject(new Error(`Refused: ${host} is a private address`));
    const req = request(
      { method: "POST", hostname: host, port: u.port || 443, path: `${u.pathname}${u.search}`, headers: { "content-type": "application/json", "user-agent": "Aftershock-Notifications/1", ...headers, "content-length": String(Buffer.byteLength(body)) }, lookup: safeLookup as never, timeout: timeoutMs },
      (res) => {
        res.resume(); // drain without buffering the body
        res.on("end", () => resolve({ status: res.statusCode ?? 0 }));
        res.on("error", reject);
      },
    );
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`Timed out after ${timeoutMs} ms`)));
    req.on("error", reject);
    req.end(body);
  });
}

type Resolve = (host: string) => Promise<{ address: string; family: number }[]>;
const resolveAll: Resolve = (host) => dnsPromises.lookup(host, { all: true });

/**
 * For clients we can't hand a custom DNS lookup to (the model SDK): resolve the host right before the
 * call and refuse if any answer is private. Narrows DNS-rebinding to the moment between check and call.
 */
export async function assertPublicHost(url: string, resolve: Resolve = resolveAll): Promise<void> {
  const host = new URL(url).hostname.replace(/^\[|\]$/g, "");
  const addrs = isIP(host) ? [{ address: host, family: isIP(host) }] : await resolve(host);
  if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address))) throw new Error(`Refused: ${host} resolves to a private address`);
}
