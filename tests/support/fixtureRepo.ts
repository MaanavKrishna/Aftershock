import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** A tiny Python repo with a duplicate-payment bug and a commit that fixes it. */
export function makeLedgerRepo(): { dir: string; parent: string; fix: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aftershock-ledger-"));
  const git = (...a: string[]) => execFileSync("git", ["-C", dir, ...a], { encoding: "utf8" }).trim();
  git("init", "-q", "-b", "main");
  git("config", "user.email", "fixture@example.invalid");
  git("config", "user.name", "Fixture");
  fs.writeFileSync(path.join(dir, "requirements.txt"), "");
  fs.writeFileSync(path.join(dir, "ledger.py"), "PAYMENTS = []\n\n\ndef pay(order_id):\n    PAYMENTS.append(order_id)\n    return 201\n");
  git("add", "-A");
  git("commit", "-qm", "feat: payments");
  const parent = git("rev-parse", "HEAD");
  fs.writeFileSync(path.join(dir, "ledger.py"), "PAYMENTS = []\n\n\ndef pay(order_id):\n    if order_id in PAYMENTS:\n        return 400\n    PAYMENTS.append(order_id)\n    return 201\n");
  git("commit", "-qam", "fix: reject duplicate payment");
  const fix = git("rev-parse", "HEAD");
  return { dir, parent, fix };
}

export const LEDGER_TEST = `from ledger import pay, PAYMENTS


def test_retry_is_rejected():
    PAYMENTS.clear()
    assert pay(1) == 201
    assert pay(1) == 400
`;

export function dockerAvailable(): boolean {
  try {
    execFileSync("docker", ["info"], { stdio: "ignore", timeout: 10_000 });
    return true;
  } catch {
    return false;
  }
}
