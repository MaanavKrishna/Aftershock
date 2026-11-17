import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { authorizeUrl, exchangeCode, fetchInstallationIds, fetchUser } from "@/lib/auth/github-oauth";

const fetchMock = vi.fn<typeof fetch>();
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("AUTH_GITHUB_ID", "client-123");
  vi.stubEnv("AUTH_GITHUB_SECRET", "shh");
});
afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("GitHub OAuth", () => {
  test("the authorize URL carries the client id, callback, scopes and state", () => {
    const u = new URL(authorizeUrl("state-abc", "https://aftershock.example"));
    expect(u.origin + u.pathname).toBe("https://github.com/login/oauth/authorize");
    expect(Object.fromEntries(u.searchParams)).toEqual({ client_id: "client-123", redirect_uri: "https://aftershock.example/api/auth/callback", scope: "read:user read:org", state: "state-abc" });
  });

  test("exchanging a code posts the app credentials and returns the token", async () => {
    fetchMock.mockResolvedValueOnce(json({ access_token: "gho_token", token_type: "bearer" }));
    expect(await exchangeCode("code-1")).toBe("gho_token");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://github.com/login/oauth/access_token");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({ Accept: "application/json" });
    expect(JSON.parse(String(init?.body))).toEqual({ client_id: "client-123", client_secret: "shh", code: "code-1" });
  });

  test("a refused code raises GitHub's reason, or a generic one", async () => {
    fetchMock.mockResolvedValueOnce(json({ error: "bad_verification_code", error_description: "The code passed is incorrect or expired." }));
    await expect(exchangeCode("old")).rejects.toThrow("The code passed is incorrect or expired.");
    fetchMock.mockResolvedValueOnce(json({}));
    await expect(exchangeCode("old")).rejects.toThrow("GitHub did not return an access token");
  });

  test("the user is read with the token; a failed lookup says which status", async () => {
    fetchMock.mockResolvedValueOnce(json({ id: 7, login: "octo", name: null, avatar_url: "https://a/7" }));
    expect(await fetchUser("gho_token")).toEqual({ id: 7, login: "octo", name: null, avatar_url: "https://a/7" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.github.com/user");
    expect(init?.headers).toMatchObject({ Authorization: "Bearer gho_token" });
    fetchMock.mockResolvedValueOnce(json({ message: "Bad credentials" }, 401));
    await expect(fetchUser("expired")).rejects.toThrow("GitHub user lookup failed (401)");
  });

  test("installation ids, or none when GitHub refuses or sends nothing", async () => {
    fetchMock.mockResolvedValueOnce(json({ total_count: 2, installations: [{ id: 11 }, { id: 22 }] }));
    expect(await fetchInstallationIds("t")).toEqual([11, 22]);
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://api.github.com/user/installations?per_page=100");
    fetchMock.mockResolvedValueOnce(json({ message: "nope" }, 403));
    expect(await fetchInstallationIds("t")).toEqual([]);
    fetchMock.mockResolvedValueOnce(json({ total_count: 0 }));
    expect(await fetchInstallationIds("t")).toEqual([]);
  });

  test("network failures propagate to the caller", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    await expect(fetchUser("t")).rejects.toThrow("fetch failed");
  });
});
