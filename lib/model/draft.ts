import type { Drafter, DraftInput } from "@/lib/timetravel/deps";
import { complete } from "./provider";
import { fence } from "./fence";
import { DRAFT_SYSTEM } from "./prompts";
import { parseModelJson, validateDraft } from "./validate";

export function draftPrompt(i: DraftInput): string {
  const parts = [
    `Incident ${i.key}. Framework: ${i.framework}. Put the test under ${i.testDir}/ (for pytest: ${i.testDir}/test_<name>.py; otherwise ${i.testDir}/<name>.test.ts).`,
    fence("incident", `Title: ${i.incident.title}\nTrigger: ${i.incident.trigger}\nObserved: ${i.incident.observed}\nExpected: ${i.incident.expected}`),
    fence("fix diff", `Fix commit: ${i.fixTitle}\nChanged files: ${i.changedFiles.join(", ")}\n\n${i.diff}`),
    ...i.context.map((c) => fence(`file ${c.name} (${c.note})`, c.content)),
  ];
  if (i.previous) parts.push(fence("previous draft", i.previous));
  if (i.feedback) parts.push(`Why the previous draft was not admitted: ${i.feedback}`);
  if (i.hint) parts.push(fence("hint from the team", i.hint));
  return parts.join("\n\n");
}

export function modelDrafter(): Drafter {
  return {
    async draft(input) {
      const res = await complete(input.workspaceId, [
        { role: "system", content: DRAFT_SYSTEM },
        { role: "user", content: draftPrompt(input) },
      ]);
      const draft = validateDraft(parseModelJson(res.text), { framework: input.framework, testDir: input.testDir });
      return { ...draft, model: res.model, tokens: res.tokens };
    },
  };
}
