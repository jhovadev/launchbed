import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { DEFAULT_TARGET, findTarget, type TargetId } from "@launchbed/schema";
import { EXPO_PINS, FLUTTER_PINS, TOOLCHAIN } from "./versions";

export interface DoctorCheck {
  id: string;
  ok: boolean;
  required: boolean;
  detail: string;
}

export interface DoctorReport {
  target: TargetId;
  ok: boolean;
  checks: DoctorCheck[];
}

function run(command: string, args: string[]): { status: number | null; stdout: string; stderr: string; missing: boolean } {
  const result = spawnSync(command, args, { shell: false, encoding: "utf8", timeout: 15_000 });
  return {
    status: result.status,
    stdout: (result.stdout ?? "").trim(),
    stderr: (result.stderr ?? "").trim(),
    missing: Boolean(result.error && "code" in result.error && (result.error as NodeJS.ErrnoException).code === "ENOENT"),
  };
}

function checkJava(): DoctorCheck {
  const result = run("java", ["-version"]);
  if (result.missing) {
    return { id: "jdk", ok: false, required: true, detail: "java was not found on PATH. Install JDK 21 (mise install java@temurin-21.0.13+9.0.LTS)." };
  }
  const text = `${result.stderr}\n${result.stdout}`;
  const match = /version "(\d+)/.exec(text);
  const major = match ? Number(match[1]) : undefined;
  const ok = major !== undefined && major >= TOOLCHAIN.jdk;
  return {
    id: "jdk",
    ok,
    required: true,
    detail: ok ? `java ${major}` : `java ${major ?? "unknown"} is below the required JDK ${TOOLCHAIN.jdk}.`,
  };
}

function checkAndroidSdk(): DoctorCheck {
  const home = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT ?? "";
  if (!home) {
    return { id: "android-sdk", ok: false, required: true, detail: "ANDROID_HOME is unset." };
  }
  const platform = existsSync(`${home}/platforms/android-37.0`);
  const buildTools = existsSync(`${home}/build-tools/36.0.0`);
  const platformTools = existsSync(`${home}/platform-tools/adb`) || existsSync(`${home}/platform-tools/adb.exe`);
  const ok = platform && buildTools && platformTools;
  return {
    id: "android-sdk",
    ok,
    required: true,
    detail: ok
      ? `ANDROID_HOME=${home} (platform 37.0, build-tools 36.0.0, platform-tools)`
      : `ANDROID_HOME=${home} is missing required packages (need platforms/android-37.0, build-tools/36.0.0, platform-tools).`,
  };
}

function checkOnPath(id: string, command: string, args: string[], required: boolean, hint: string): DoctorCheck {
  const result = run(command, args);
  if (result.missing) {
    return { id, ok: false, required, detail: hint };
  }
  const version = (result.stdout || result.stderr).split("\n")[0] ?? command;
  return { id, ok: result.status === 0, required, detail: version };
}

function checkNode(): DoctorCheck {
  const result = run("node", ["-v"]);
  if (result.missing) {
    return { id: "node", ok: false, required: true, detail: `node was not found. Expo SDK ${EXPO_PINS.sdk} needs Node ${EXPO_PINS.node} (or ^22.13 || ^24.3 || ^26 || >=27).` };
  }
  const version = result.stdout.replace(/^v/, "");
  const major = Number(version.split(".")[0]);
  const ok = major === 22 || major === 24 || major === 26 || major >= 27;
  return {
    id: "node",
    ok,
    required: true,
    detail: ok ? `node ${version}` : `node ${version} is outside the Expo SDK ${EXPO_PINS.sdk} engines (^22.13 || ^24.3 || ^26 || >=27).`,
  };
}

export function collectDoctorReport(targetId: string = DEFAULT_TARGET): DoctorReport {
  const target = findTarget(targetId);
  if (!target) {
    return {
      target: DEFAULT_TARGET,
      ok: false,
      checks: [{ id: "target", ok: false, required: true, detail: `Unknown target "${targetId}".` }],
    };
  }
  const checks: DoctorCheck[] = [];
  if (target.id === "android-compose") {
    checks.push(checkJava(), checkAndroidSdk());
  }
  if (target.id === "expo") {
    checks.push(
      checkNode(),
      checkOnPath("npx", "npx", ["--version"], true, "npx was not found. Install npm / Node.js."),
    );
  }
  if (target.id === "flutter") {
    checks.push(
      checkOnPath(
        "flutter",
        "flutter",
        ["--version"],
        true,
        `flutter was not found. Install Flutter ${FLUTTER_PINS.sdk} with mise install flutter@${FLUTTER_PINS.sdk}.`,
      ),
    );
  }
  checks.push(
    checkOnPath("just", "just", ["--version"], false, "just is optional but recommended."),
    checkOnPath("mise", "mise", ["--version"], false, "mise is optional but recommended for pinned tool versions."),
  );
  const ok = checks.every((check) => check.ok || !check.required);
  return { target: target.id, ok, checks };
}
