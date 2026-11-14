#!/usr/bin/env bun
/**
 * Real Android smoke test: generate the example ZIP, extract it with the
 * project's own ZIP reader, then run Gradle assembleDebug + unit tests.
 * Exits 78 (EX_CONFIG) with BLOCKED when no Android SDK is configured.
 */
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generateProject, parseRequestJson, readZip } from "@android-initializr/generator";

const root = join(import.meta.dir, "..");
const outDir = join(root, "build", "android-smoke");
const projectDir = join(outDir, "project");
const sdkRoot = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;

function fail(message: string): never {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

if (!sdkRoot || !existsSync(sdkRoot)) {
  console.error("BLOCKED: ANDROID_HOME/ANDROID_SDK_ROOT is not set to an existing SDK.");
  console.error("Install the SDK (see docs/phases/F0-foundation.md) and rerun `just android-smoke`.");
  process.exit(78);
}

const request = parseRequestJson(readFileSync(join(root, "examples", "basic.json"), "utf8"));
const project = generateProject(request);

rmSync(outDir, { recursive: true, force: true });
mkdirSync(projectDir, { recursive: true });
writeFileSync(join(outDir, project.fileName), project.zip);

const entries = readZip(project.zip);
for (const entry of entries) {
  const target = join(projectDir, entry.path);
  if (!target.startsWith(projectDir)) fail(`path escaped the extraction directory: ${entry.path}`);
  mkdirSync(join(target, ".."), { recursive: true });
  writeFileSync(target, entry.data);
  chmodSync(target, entry.executable ? 0o755 : 0o644);
}
console.log(`STEP extracted: ${entries.length} files, ${project.plan.totals.bytes} bytes`);

if (!existsSync(join(projectDir, "gradlew"))) fail("gradlew is missing from the ZIP");
const wrapper = readFileSync(join(projectDir, "gradle", "wrapper", "gradle-wrapper.properties"), "utf8");
if (!wrapper.includes("distributionSha256Sum=")) fail("Gradle wrapper has no distribution checksum");
console.log("STEP wrapper: gradlew present with checksum pin");

const result = spawnSync(
  "./gradlew",
  [":app:assembleDebug", ":app:testDebugUnitTest", "--no-daemon", "--console=plain"],
  { cwd: projectDir, stdio: "inherit", env: { ...process.env, ANDROID_HOME: sdkRoot } },
);
if (result.status !== 0) fail(`Gradle exited with status ${result.status ?? "unknown"}`);

const apk = join(projectDir, "app", "build", "outputs", "apk", "debug", "app-debug.apk");
if (!existsSync(apk)) fail("app-debug.apk was not produced");
console.log(`STEP apk: ${apk} (${readFileSync(apk).length} bytes)`);

const testDir = join(projectDir, "app", "build", "test-results", "testDebugUnitTest");
if (!existsSync(testDir)) fail("unit test results directory is missing");
const total = spawnSync("grep", ["-h", "testsuite name", "-r", testDir], { encoding: "utf8" });
if (total.status !== 0 || !total.stdout.includes('failures="0"')) {
  fail("unit tests did not report zero failures");
}
console.log("PASS: assembleDebug produced an APK and unit tests passed");
