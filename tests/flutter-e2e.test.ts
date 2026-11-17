import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { describe, expect, test } from "bun:test";

const enabled = process.env.LAUNCHBED_E2E_FLUTTER === "1";

describe.skipIf(!enabled)("flutter e2e (LAUNCHBED_E2E_FLUTTER=1)", () => {
  test("launchbed new --target flutter then flutter analyze", () => {
    const out = join(tmpdir(), `launchbed-e2e-flutter-${process.pid}`);
    rmSync(out, { recursive: true, force: true });
    const cli = spawnSync(
      "bun",
      [
        join(import.meta.dir, "../packages/cli/src/index.ts"),
        "new",
        "--yes",
        "--name",
        "Flutter E2E",
        "--app-id",
        "com.example.fluttere2e",
        "--target",
        "flutter",
        "--out",
        out,
        "--force",
      ],
      { encoding: "utf8", timeout: 10 * 60 * 1000, env: { ...process.env, CI: "1" } },
    );
    if (cli.status !== 0) {
      throw new Error(`launchbed new failed:\n${cli.stdout}\n${cli.stderr}`);
    }
    expect(existsSync(join(out, "launchbed.json"))).toBe(true);
    expect(existsSync(join(out, "lib/tokens/tokens.dart"))).toBe(true);
    const pub = spawnSync("flutter", ["pub", "get"], { cwd: out, encoding: "utf8", timeout: 5 * 60 * 1000, shell: false });
    if (pub.status !== 0) {
      throw new Error(`flutter pub get failed:\n${pub.stdout}\n${pub.stderr}`);
    }
    const analyze = spawnSync("flutter", ["analyze"], { cwd: out, encoding: "utf8", timeout: 5 * 60 * 1000, shell: false });
    if (analyze.status !== 0) {
      throw new Error(`flutter analyze failed:\n${analyze.stdout}\n${analyze.stderr}`);
    }
  }, 15 * 60 * 1000);
});
