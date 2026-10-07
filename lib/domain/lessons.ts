export type Lesson = { key: string; title: string; files: string[]; expected: string; testPath: string };

/** Memory rendered as guidance that AI coding agents read before changing risky code. */
export function renderLessons(entries: Lesson[]): string {
  const lines = [
    "# Lessons from production (Aftershock)",
    "",
    "Each lesson below is backed by a test that failed before its fix and passed after. Keep these behaviours when you change the listed files.",
    "",
  ];
  for (const e of entries) {
    lines.push(`## ${e.key} · ${e.files.join(", ") || "unknown files"}`, e.title + ".", `Expected: ${e.expected}`, `Test: ${e.testPath}`, "");
  }
  return lines.join("\n");
}
