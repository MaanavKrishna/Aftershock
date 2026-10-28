import { SignJWT, jwtVerify } from "jose";

/** sid names the server-side session row (lib/auth/sessions.ts); tokens without one are not accepted by the app. */
export type Session = { userId: string; workspaceId: string; sid?: string };
export const SESSION_COOKIE = "as_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

function key(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET must be set to at least 32 characters");
  return new TextEncoder().encode(secret);
}

export async function signSession(session: Session, ttlSeconds = SESSION_TTL_SECONDS): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ userId: session.userId, workspaceId: session.workspaceId, ...(session.sid ? { sid: session.sid } : {}) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + ttlSeconds)
    .sign(key());
}

export async function verifySession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (typeof payload.userId !== "string" || typeof payload.workspaceId !== "string") return null;
    return { userId: payload.userId, workspaceId: payload.workspaceId, ...(typeof payload.sid === "string" ? { sid: payload.sid } : {}) };
  } catch {
    return null;
  }
}
