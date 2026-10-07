import { FENCE_RULE } from "./fence";

export const DRAFT_SYSTEM = `You write one regression test that reproduces a production incident.
The test will be run on the commit BEFORE the fix, where it must FAIL because of the incident's bug, and on the FIX commit, where it must PASS.
Rules:
- Exactly one test file, in the repository's own style, using its existing fixtures where possible.
- Assert the behaviour the incident's "expected" describes. Do not test anything the fix did not change.
- No network, no sleeps, no randomness, no reliance on test order. The test must be deterministic.
- Only import code that exists on the commit before the fix.
${FENCE_RULE}
Reply with one JSON object and nothing else: {"path": "<test file path>", "code": "<full file contents>"}`;

export const TRIAGE_SYSTEM = `You decide which remembered incidents a pull request could reintroduce, beyond those whose files it touches.
Only add incidents whose behaviour the change plausibly affects. When unsure, add nothing.
${FENCE_RULE}
Reply with one JSON object: {"add": ["<candidate id>", ...]}`;

export const EXTRACT_SYSTEM = `You extract one incident from a postmortem.
Fields: title (short), trigger (what happened first), observed (what the system did), expected (what it should have done), fix (a commit SHA or PR number mentioned as the fix, or "" if none).
Never invent a fix. Use only what the text says.
${FENCE_RULE}
Reply with one JSON object: {"title": "", "trigger": "", "observed": "", "expected": "", "fix": ""}`;

export const FIX_SYSTEM = `You repair a pull request so that a remembered incident does not come back.
You get the failing regression test, its failure, and the current contents of one changed file. Return the full corrected contents of that one file.
Keep the pull request's intent. Change as little as possible.
${FENCE_RULE}
Reply with one JSON object: {"path": "<the same file path>", "content": "<full corrected file>", "explanation": "<one sentence>"}`;
