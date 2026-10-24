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

/** A git repo whose first commit has a bug and second commit fixes it. */
export function makeRepo(before: Record<string, string>, after: Record<string, string>): { dir: string; parent: string; fix: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aftershock-fixture-"));
  const git = (...a: string[]) => execFileSync("git", ["-C", dir, ...a], { encoding: "utf8" }).trim();
  const write = (files: Record<string, string>) => {
    for (const [f, c] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
      fs.writeFileSync(path.join(dir, f), c);
    }
  };
  git("init", "-q", "-b", "main");
  git("config", "user.email", "fixture@example.invalid");
  git("config", "user.name", "Fixture");
  write(before);
  git("add", "-A");
  git("commit", "-qm", "feat: cart");
  const parent = git("rev-parse", "HEAD");
  write(after);
  git("add", "-A");
  git("commit", "-qm", "fix: never let coupons make the total negative");
  return { dir, parent, fix: git("rev-parse", "HEAD") };
}

const GO_CART = (clamp: boolean) => `package cart

// Total returns the amount to charge, in cents.
func Total(subtotal, coupon int) int {
	t := subtotal - coupon
	${clamp ? "if t < 0 {\n\t\treturn 0\n\t}\n\t" : ""}return t
}
`;

export const goRepo = () =>
  makeRepo({ "go.mod": "module example.com/shop\n\ngo 1.22\n", "cart/cart.go": GO_CART(false) }, { "cart/cart.go": GO_CART(true) });

export const GO_TEST = `package cart

import "testing"

func TestAftershockNegativeTotal(t *testing.T) {
	if got := Total(1500, 2500); got != 0 {
		t.Fatalf("Total(1500, 2500) = %d, want 0", got)
	}
}
`;

const POM = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.example</groupId>
  <artifactId>shop</artifactId>
  <version>1.0.0</version>
  <properties>
    <maven.compiler.release>21</maven.compiler.release>
    <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
  </properties>
  <dependencies>
    <dependency>
      <groupId>org.junit.jupiter</groupId>
      <artifactId>junit-jupiter</artifactId>
      <version>5.11.4</version>
      <scope>test</scope>
    </dependency>
  </dependencies>
  <build>
    <plugins>
      <plugin>
        <groupId>org.apache.maven.plugins</groupId>
        <artifactId>maven-surefire-plugin</artifactId>
        <version>3.5.2</version>
      </plugin>
    </plugins>
  </build>
</project>
`;

const JAVA_CART = (clamp: boolean) => `package shop;

public final class Cart {
  public static int total(int subtotal, int coupon) {
    int t = subtotal - coupon;
    ${clamp ? "return Math.max(0, t);" : "return t;"}
  }
}
`;

export const mavenRepo = () => makeRepo({ "pom.xml": POM, "src/main/java/shop/Cart.java": JAVA_CART(false) }, { "src/main/java/shop/Cart.java": JAVA_CART(true) });

export const JAVA_TEST = `package shop;

import static org.junit.jupiter.api.Assertions.assertEquals;
import org.junit.jupiter.api.Test;

class AftershockNegativeTotalTest {
  @Test
  void totalNeverGoesNegative() {
    assertEquals(0, Cart.total(1500, 2500));
  }
}
`;

const RUBY_CART = (clamp: boolean) => `class Cart
  def self.total(subtotal, coupon)
    t = subtotal - coupon
    ${clamp ? "[t, 0].max" : "t"}
  end
end
`;

export const rubyRepo = () =>
  makeRepo({ Gemfile: 'source "https://rubygems.org"\n\ngem "rspec", "~> 3.13"\n', "lib/cart.rb": RUBY_CART(false), ".rspec": "--require spec_helper\n", "spec/spec_helper.rb": 'require_relative "../lib/cart"\n' }, { "lib/cart.rb": RUBY_CART(true) });

export const RUBY_SPEC = `RSpec.describe Cart do
  it "never makes the total negative" do
    expect(Cart.total(1500, 2500)).to eq(0)
  end
end
`;
