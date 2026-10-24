import { describe, test, expect } from "vitest";
import { revertFix } from "@/lib/domain/revert";

const parent = "def total(items):\n    s = 0\n    for i in items:\n        s += i\n    return s\n";
const fix = "def total(items):\n    s = 0\n    for i in items:\n        s += i\n    return round(s, 2)\n";

describe("revertFix", () => {
  test("HEAD unchanged since the fix: the overlay is the parent version", () => {
    expect(revertFix([{ path: "shop/cart.py", parent, fix, head: fix }])).toEqual({ ok: true, overlay: [{ path: "shop/cart.py", content: parent }] });
  });
  test("HEAD changed elsewhere in the file: the fix is undone and the later change kept", () => {
    const head = "# cart maths\n" + fix + "\ndef count(items):\n    return len(items)\n";
    const r = revertFix([{ path: "shop/cart.py", parent, fix, head }]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.overlay[0].content).toContain("# cart maths");
    expect(r.overlay[0].content).toContain("def count(items)");
    expect(r.overlay[0].content).toContain("    return s\n");
    expect(r.overlay[0].content).not.toContain("round(s, 2)");
  });
  test("the fixed lines were rewritten since: drifted", () => {
    const head = fix.replace("return round(s, 2)", "return Decimal(s).quantize(CENT)");
    const r = revertFix([{ path: "shop/cart.py", parent, fix, head }]);
    expect(r).toMatchObject({ ok: false, reason: expect.stringMatching(/shop\/cart\.py.*changed since the fix/) });
  });
  test("a fixed file that no longer exists: drifted", () => {
    expect(revertFix([{ path: "shop/cart.py", parent, fix, head: null }])).toMatchObject({ ok: false, reason: expect.stringMatching(/no longer exists/) });
  });
  test("a file the fix deleted comes back as it was before", () => {
    expect(revertFix([{ path: "old.py", parent: "x = 1\n", fix: null, head: null }])).toEqual({ ok: true, overlay: [{ path: "old.py", content: "x = 1\n" }] });
  });
  test("a file the fix added is emptied when HEAD still has it as added; otherwise drifted", () => {
    expect(revertFix([{ path: "guard.py", parent: null, fix: "G = 1\n", head: "G = 1\n" }])).toEqual({ ok: true, overlay: [{ path: "guard.py", content: "" }] });
    expect(revertFix([{ path: "guard.py", parent: null, fix: "G = 1\n", head: "G = 2\n" }]).ok).toBe(false);
  });
  test("nothing to revert is reported, not silently passed", () => {
    expect(revertFix([])).toMatchObject({ ok: false, reason: expect.stringMatching(/no source files/i) });
  });
  test("unchanged files are skipped", () => {
    expect(revertFix([{ path: "a.py", parent: "a\n", fix: "a\n", head: "a\n" }, { path: "shop/cart.py", parent, fix, head: fix }])).toEqual({ ok: true, overlay: [{ path: "shop/cart.py", content: parent }] });
  });
});
