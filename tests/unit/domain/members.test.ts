import { test, expect } from "vitest";
import { memberChange } from "@/lib/domain/members";

test("only owners change roles or remove members", () => {
  expect(memberChange({ actor: "admin", target: "member", to: "admin", owners: 1, self: false })).toMatch(/Only owners/);
  expect(memberChange({ actor: "member", target: "member", to: "remove", owners: 1, self: false })).toMatch(/Only owners/);
  expect(memberChange({ actor: "owner", target: "member", to: "admin", owners: 1, self: false })).toBeNull();
  expect(memberChange({ actor: "owner", target: "admin", to: "remove", owners: 1, self: false })).toBeNull();
});

test("a workspace always keeps at least one owner", () => {
  expect(memberChange({ actor: "owner", target: "owner", to: "admin", owners: 1, self: true })).toMatch(/last owner/);
  expect(memberChange({ actor: "owner", target: "owner", to: "remove", owners: 1, self: true })).toMatch(/last owner/);
  expect(memberChange({ actor: "owner", target: "owner", to: "member", owners: 2, self: false })).toBeNull();
});

test("anyone may leave unless they are the last owner", () => {
  expect(memberChange({ actor: "member", target: "member", to: "remove", owners: 1, self: true })).toBeNull();
});
