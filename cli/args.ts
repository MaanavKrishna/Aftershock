import type { PrVerdict } from "@/lib/domain/verdict";
import { aggregatePr } from "@/lib/domain/verdict";

export type Framework = "pytest" | "vitest" | "jest";
export type Args =
  | { command: "prove"; fix: string; test: string; repo: string; framework?: Framework; install?: string; runs: number }
  | { command: "check"; head: string; repo: string; tests: string; framework?: Framework; install?: string; runs: number; inPlace: boolean; pr?: number; report: boolean }
  | { command: "verify"; incident: number };

const FLAGS: Record<string, string[]> = {
  prove: ["--fix", "--test", "--repo", "--framework", "--install", "--runs"],
  check: ["--head", "--repo", "--tests", "--framework", "--install", "--runs", "--in-place", "--pr", "--report"],
  verify: [],
};
const BOOL = new Set(["--in-place", "--report"]);

export function parseArgs(argv: string[]): Args {
  const [command, ...rest] = argv;
  if (!command || !(command in FLAGS)) throw new Error(`Unknown command: ${command ?? "(none)"}. Use prove, check or verify.`);
  const flags: Record<string, string | true> = {};
  const positional: string[] = [];
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (!a.startsWith("--")) {
      positional.push(a);
      continue;
    }
    if (!FLAGS[command].includes(a)) throw new Error(`Unknown option for ${command}: ${a}`);
    if (BOOL.has(a)) flags[a] = true;
    else {
      const v = rest[++i];
      if (v === undefined || v.startsWith("--")) throw new Error(`${a} needs a value`);
      flags[a] = v;
    }
  }
  const str = (k: string) => (typeof flags[k] === "string" ? (flags[k] as string) : undefined);
  const runs = Number(str("--runs") ?? 3);
  if (!Number.isInteger(runs) || runs < 1 || runs > 10) throw new Error("--runs must be between 1 and 10");
  const framework = str("--framework") as Framework | undefined;
  if (framework && !["pytest", "vitest", "jest"].includes(framework)) throw new Error("--framework must be pytest, vitest or jest");

  if (command === "verify") {
    const m = positional[0]?.match(/^[A-Za-z]+-(\d+)$|^(\d+)$/);
    if (!m) throw new Error("verify needs an incident like INC-12");
    return { command: "verify", incident: Number(m[1] ?? m[2]) };
  }
  if (command === "prove") {
    if (!str("--fix")) throw new Error("prove needs --fix <commit>");
    if (!str("--test")) throw new Error("prove needs --test <path to the test file>");
    return { command: "prove", fix: str("--fix")!, test: str("--test")!, repo: str("--repo") ?? ".", framework, install: str("--install"), runs };
  }
  const pr = str("--pr") ? Number(str("--pr")) : undefined;
  if (pr !== undefined && !Number.isInteger(pr)) throw new Error("--pr must be a number");
  return { command: "check", head: str("--head") ?? "HEAD", repo: str("--repo") ?? ".", tests: str("--tests") ?? "tests/aftershock", framework, install: str("--install"), runs, inPlace: flags["--in-place"] === true, pr, report: flags["--report"] === true };
}

export function exitCodeForCheck(verdicts: PrVerdict[]): number {
  const v = aggregatePr(verdicts);
  return v === "recur" ? 1 : v === "inconclusive" ? 2 : 0;
}

export function exitCodeForProve(status: "proven" | "rejected" | "unproven"): number {
  return status === "proven" ? 0 : 2;
}
