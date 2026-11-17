import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { describe, expect, test } from "bun:test";
import { loadComponentCatalog } from "@launchbed/generator";

const enabled = process.env.LAUNCHBED_E2E_FLUTTER === "1";

describe.skipIf(!enabled)("flutter e2e (LAUNCHBED_E2E_FLUTTER=1)", () => {
  test("launchbed new --target flutter --preset app-starter: analyze and flutter test", () => {
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
        "--preset",
        "app-starter",
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
    expect(existsSync(join(out, "lib/launchbed/app_shell.dart"))).toBe(true);
    expect(existsSync(join(out, "test/auth_validator_test.dart"))).toBe(true);
    // Copy every registry component so the toolchain checks them too.
    for (const component of loadComponentCatalog().components) {
      const added = spawnSync("bun", [join(import.meta.dir, "../packages/cli/src/index.ts"), "add", component.name], {
        cwd: out,
        encoding: "utf8",
        timeout: 60 * 1000,
      });
      if (added.status !== 0) {
        throw new Error(`launchbed add ${component.name} failed:\n${added.stdout}\n${added.stderr}`);
      }
    }
    const pub = spawnSync("flutter", ["pub", "get"], { cwd: out, encoding: "utf8", timeout: 5 * 60 * 1000, shell: false });
    if (pub.status !== 0) {
      throw new Error(`flutter pub get failed:\n${pub.stdout}\n${pub.stderr}`);
    }
    const analyze = spawnSync("flutter", ["analyze"], { cwd: out, encoding: "utf8", timeout: 5 * 60 * 1000, shell: false });
    if (analyze.status !== 0) {
      throw new Error(`flutter analyze failed:\n${analyze.stdout}\n${analyze.stderr}`);
    }
    expect(analyze.stdout).toContain("No issues found");
    const tested = spawnSync("flutter", ["test"], { cwd: out, encoding: "utf8", timeout: 5 * 60 * 1000, shell: false });
    if (tested.status !== 0) {
      throw new Error(`flutter test failed:\n${tested.stdout}\n${tested.stderr}`);
    }
    expect(tested.stdout).toContain("All tests passed");
  }, 15 * 60 * 1000);
});
