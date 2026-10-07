import { test, expect } from "vitest";
import { openOrReusePr } from "@/lib/github/botPr";

const client = (open: number[]) => ({
  request: async (route: string, params: Record<string, unknown>) => {
    if (route.startsWith("POST")) {
      if (open.length) throw Object.assign(new Error("A pull request already exists"), { status: 422 });
      return { data: { number: 9 } };
    }
    expect(params).toMatchObject({ owner: "o", repo: "r", head: "o:aftershock/inc-2", state: "open" });
    return { data: open.map((number) => ({ number })) };
  },
});

test("opens a new pull request when none is open for the branch", async () => {
  expect(await openOrReusePr(client([]), { owner: "o", repo: "r", head: "aftershock/inc-2", base: "main", title: "t", body: "b" })).toBe(9);
});

test("reuses the open pull request when the branch already has one", async () => {
  expect(await openOrReusePr(client([6]), { owner: "o", repo: "r", head: "aftershock/inc-2", base: "main", title: "t", body: "b" })).toBe(6);
});
