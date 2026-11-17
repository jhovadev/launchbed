import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { describe, expect, test } from "bun:test";
import { loadComponentCatalog } from "@launchbed/generator";

const enabled = process.env.LAUNCHBED_E2E_EXPO === "1";

describe.skipIf(!enabled)("expo e2e (LAUNCHBED_E2E_EXPO=1)", () => {
  test("launchbed new --target expo then typechecks the official project", () => {
    const out = join(tmpdir(), `launchbed-e2e-expo-${process.pid}`);
    rmSync(out, { recursive: true, force: true });
    const cli = spawnSync(
      "bun",
      [
        join(import.meta.dir, "../packages/cli/src/index.ts"),
        "new",
        "--yes",
        "--name",
        "Expo E2E",
        "--app-id",
        "com.example.expoe2e",
        "--target",
        "expo",
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
    expect(existsSync(join(out, "tokens/tokens.ts"))).toBe(true);
    expect(existsSync(join(out, "package.json"))).toBe(true);
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
    const install = spawnSync("npm", ["install", "--no-audit", "--no-fund"], {
      cwd: out,
      encoding: "utf8",
      timeout: 10 * 60 * 1000,
      shell: false,
    });
    if (install.status !== 0) {
      throw new Error(`npm install failed:\n${install.stdout}\n${install.stderr}`);
    }
    const check = spawnSync("npx", ["tsc", "--noEmit"], {
      cwd: out,
      encoding: "utf8",
      timeout: 5 * 60 * 1000,
      shell: false,
    });
    // Launchbed-owned files (registry components, tokens) must typecheck even when the
    // official template's own files report errors.
    const ownErrors = `${check.stdout}\n${check.stderr}`
      .split("\n")
      .filter((line) => /^(components\/ui|tokens)\//.test(line));
    expect(ownErrors).toEqual([]);
    if (check.status !== 0) {
      // Fallback: expo export if tsc is missing or fails for template reasons
      const exported = spawnSync("npx", ["expo", "export", "--platform", "web"], {
        cwd: out,
        encoding: "utf8",
        timeout: 5 * 60 * 1000,
        shell: false,
      });
      if (exported.status !== 0) {
        throw new Error(`tsc and expo export failed.\ntsc:\n${check.stdout}\n${check.stderr}\nexport:\n${exported.stdout}\n${exported.stderr}`);
      }
    }
  }, 15 * 60 * 1000);
});
