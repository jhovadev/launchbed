import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TEMPLATE = join(import.meta.dir, "..", "templates", "android-compose-minimal");

function stubAdb(devices: string[]): { bin: string; path: string } {
  const bin = mkdtempSync(join(tmpdir(), "ai-adb-"));
  const lines = devices.map((serial) => `${serial}\tdevice`).join("\\n");
  writeFileSync(
    join(bin, "adb"),
    `#!/usr/bin/env bash\nprintf 'List of devices attached\\n${lines}\\n'\n`,
  );
  chmodSync(join(bin, "adb"), 0o755);
  return { bin, path: `${bin}:${process.env.PATH ?? ""}` };
}

function runDevice(args: string[], env: Record<string, string | undefined>) {
  return spawnSync("bash", [join(TEMPLATE, "scripts", "device.sh"), ...args], {
    cwd: TEMPLATE,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

describe("device selection script", () => {
  test("uses ANDROID_SERIAL without touching adb", () => {
    const result = runDevice(["serial"], { ANDROID_SERIAL: "emulator-5554", PATH: "/usr/bin:/bin" });
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe("emulator-5554");
  });

  test("uses the only connected device", () => {
    const adb = stubAdb(["R58M123456A"]);
    const result = runDevice(["serial"], { ANDROID_SERIAL: undefined, PATH: adb.path });
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe("R58M123456A");
  });

  test("refuses to guess when several devices are connected without a TTY", () => {
    const adb = stubAdb(["device-a", "device-b"]);
    const result = runDevice(["serial"], { ANDROID_SERIAL: undefined, PATH: adb.path });
    expect(result.status).toBe(3);
    expect(result.stderr).toContain("Multiple devices detected");
    expect(result.stderr).toContain("ANDROID_SERIAL");
  });

  test("task.sh dispatches device listing through the bash implementation", () => {
    const adb = stubAdb(["device-a"]);
    const result = spawnSync("bash", [join(TEMPLATE, "scripts", "task.sh"), "device", "devices"], {
      cwd: TEMPLATE,
      encoding: "utf8",
      env: { ...process.env, PATH: adb.path },
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("device-a");
  });
});
