import { describe, test, expect } from "vitest";
import { mergeLessons, START, END } from "@/lib/domain/agentsMd";

const lessons = "# Lessons from production (Aftershock)\n\n- INC-1 retry charged twice\n";

describe("mergeLessons", () => {
  test("creates AGENTS.md with the marked section when there is none", () => {
    const out = mergeLessons(null, lessons);
    expect(out.startsWith("# AGENTS.md")).toBe(true);
    expect(out).toContain(`${START}\n## Lessons from production (Aftershock)`);
    expect(out).toContain("- INC-1 retry charged twice");
    expect(out.trimEnd().endsWith(END)).toBe(true);
  });
  test("appends the section and keeps everything the team wrote", () => {
    const mine = "# AGENTS.md\n\nUse pnpm.\n";
    const out = mergeLessons(mine, lessons);
    expect(out.startsWith(mine.trimEnd())).toBe(true);
    expect(out).toContain(START);
  });
  test("replaces only the marked section on later syncs", () => {
    const first = mergeLessons("# AGENTS.md\n\nUse pnpm.\n", lessons);
    const edited = first + "\n## Testing\n\nRun pytest.\n";
    const second = mergeLessons(edited, lessons.replace("INC-1 retry charged twice", "INC-2 refunds round down"));
    expect(second).toContain("INC-2 refunds round down");
    expect(second).not.toContain("INC-1 retry charged twice");
    expect(second).toContain("Use pnpm.");
    expect(second).toContain("## Testing\n\nRun pytest.");
    expect(second.split(START).length).toBe(2);
  });
  test("is idempotent", () => {
    const once = mergeLessons("x\n", lessons);
    expect(mergeLessons(once, lessons)).toBe(once);
  });
});
