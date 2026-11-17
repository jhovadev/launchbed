import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
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
  test("validates ANDROID_SERIAL against authorized online ADB devices", () => {
    const adb = stubAdb(["emulator-5554"]);
    const result = runDevice(["serial"], { ANDROID_SERIAL: "emulator-5554", PATH: adb.path });
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe("emulator-5554");
  });

  test("rejects a stale ANDROID_SERIAL instead of using another device", () => {
    const adb = stubAdb(["online-device"]);
    const result = runDevice(["serial"], { ANDROID_SERIAL: "missing-device", PATH: adb.path });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("not connected");
  });

  test("rejects malicious or invalid ANDROID_SERIAL", () => {
    const adb = stubAdb(["device-a"]);
    const result = runDevice(["serial"], { ANDROID_SERIAL: "device-a;rm", PATH: adb.path });
    expect(result.status).toBe(2);
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


function stubAdbCommands(devices: string[], handler: string): { path: string } {
  const bin = mkdtempSync(join(tmpdir(), "ai-adb-"));
  const lines = devices.map((serial) => `${serial}\tdevice`).join("\\n");
  writeFileSync(
    join(bin, "adb"),
    `#!/usr/bin/env bash
if [ "$1" = "devices" ]; then
  printf 'List of devices attached\\n${lines}\\n'
  exit 0
fi
${handler}
`,
  );
  chmodSync(join(bin, "adb"), 0o755);
  return { path: `${bin}:${process.env.PATH ?? ""}` };
}

describe("device screenshot, deeplink and data commands", () => {
  test("screenshot writes the screencap when ANDROID_SERIAL is valid", () => {
    const adb = stubAdbCommands(
      ["emulator-5554"],
      `if [ "$1" = "-s" ] && [ "$3" = "exec-out" ]; then printf 'PNGDATA'; exit 0; fi
echo "unexpected: $*" >&2; exit 9`,
    );
    const out = join(TEMPLATE, "launchbed-test-shot.png");
    try {
      const result = spawnSync("bash", [join(TEMPLATE, "scripts", "device.sh"), "screenshot", "launchbed-test-shot.png"], {
        cwd: TEMPLATE,
        encoding: "utf8",
        env: { ...process.env, ANDROID_SERIAL: "emulator-5554", PATH: adb.path },
      });
      expect(result.status).toBe(0);
      expect(readFileSync(out, "utf8")).toBe("PNGDATA");
    } finally {
      try { unlinkSync(out); } catch { /* ignore */ }
    }
  });

  test("screenshot refuses a path that escapes the project", () => {
    const adb = stubAdbCommands(["emulator-5554"], "exit 0");
    const result = runDevice(["screenshot", "../escape.png"], { ANDROID_SERIAL: "emulator-5554", PATH: adb.path });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("Refusing screenshot path");
  });

  test("deeplink refuses shell metacharacters", () => {
    const adb = stubAdbCommands(["emulator-5554"], "exit 0");
    const result = runDevice(["deeplink", "https://example.com/$(reboot)"], {
      ANDROID_SERIAL: "emulator-5554",
      PATH: adb.path,
    });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("Refusing deeplink");
  });

  test("clear-data uses the selected serial", () => {
    const adb = stubAdbCommands(
      ["emulator-5554"],
      `if [ "$1" = "-s" ] && [ "$2" = "emulator-5554" ] && [ "$3" = "shell" ] && [ "$4" = "pm" ]; then
  echo "cleared"; exit 0
fi
echo "unexpected: $*" >&2; exit 9`,
    );
    const result = runDevice(["clear-data"], { ANDROID_SERIAL: "emulator-5554", PATH: adb.path });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("cleared");
  });
});
