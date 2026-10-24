import { describe, test, expect } from "vitest";
import { checkTargetUrl, isPrivateAddress, postJson } from "@/lib/net/safeFetch";

describe("isPrivateAddress", () => {
  test.each([
    "127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "255.255.255.255", "198.18.0.1",
    "::1", "::", "fc00::1", "fd00:ec2::254", "fe80::1", "ff02::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1", "64:ff9b::a00:1",
  ])("%s is refused", (ip) => expect(isPrivateAddress(ip)).toBe(true));
  test.each(["1.1.1.1", "8.8.8.8", "172.32.0.1", "52.4.1.1", "2606:4700:4700::1111", "::ffff:8.8.8.8"])("%s is allowed", (ip) => expect(isPrivateAddress(ip)).toBe(false));
  test("anything that is not an address is refused", () => expect(isPrivateAddress("not-an-ip")).toBe(true));
});

describe("checkTargetUrl", () => {
  test("Slack targets must be hooks.slack.com over https", () => {
    expect(checkTargetUrl("https://hooks.slack.com/services/T0/B0/xyz", "slack")).toBeNull();
    expect(checkTargetUrl("https://evil.example.com/services/T0/B0/xyz", "slack")).toMatch(/hooks\.slack\.com/);
    expect(checkTargetUrl("http://hooks.slack.com/services/T0/B0/xyz", "slack")).toMatch(/https/);
  });
  test("webhook targets: public https, no credentials, no private address literals", () => {
    expect(checkTargetUrl("https://ops.example.com/hooks/aftershock", "webhook")).toBeNull();
    expect(checkTargetUrl("http://ops.example.com/x", "webhook")).toMatch(/https/);
    expect(checkTargetUrl("https://user:pw@ops.example.com/x", "webhook")).toMatch(/credentials/);
    expect(checkTargetUrl("https://127.0.0.1/x", "webhook")).toMatch(/private/);
    expect(checkTargetUrl("https://[::1]/x", "webhook")).toMatch(/private/);
    expect(checkTargetUrl("https://localhost/x", "webhook")).toMatch(/private/);
    expect(checkTargetUrl("https://metadata.google.internal/x", "webhook")).toMatch(/private/);
    expect(checkTargetUrl("not a url", "webhook")).toMatch(/valid/);
  });
});

describe("postJson", () => {
  test("a hostname that resolves to a private address is refused at connect time", async () => {
    await expect(postJson("https://localhost.:9/x", "{}", {}, 2000)).rejects.toThrow(/private/);
  });
  test("an address literal is refused before connecting", async () => {
    await expect(postJson("https://127.0.0.1:9/x", "{}", {}, 2000)).rejects.toThrow(/private/);
  });
});
