#!/usr/bin/env bun
/** F1.6B opt-in benchmarks. No SDK installations, device commands or CI timing gates. */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir, platform, arch } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createZip,
  generateProject,
  isExecutablePath,
  materializeProject,
  parseRequest,
  readZip,
  verifyZipAgainstPlan,
} from '@launchbed/generator';
import { parseBenchmarkArgs, summarize } from './performance/metrics.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'build', 'performance');
const SEED = JSON.parse(readFileSync(join(ROOT, 'examples/basic.json'), 'utf8')) as Record<string, unknown>;

type Phase = 'materialize' | 'package' | 'verify';
interface OneSample { materialize: number; package: number; verify: number; total: number; heapUsedBytes: number; rssBytes: number }
interface CommandResult { ok: boolean; elapsedMs: number; summary: string }

function checksum(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}
function requestFor(preset: string) {
  return parseRequest({
    ...SEED,
    projectName: `Benchmark ${preset}`,
    preset,
    addons: [],
    applicationId: `dev.launchbed.benchmark.${preset.replaceAll('-', '')}`,
    namespace: `dev.launchbed.benchmark.${preset.replaceAll('-', '')}`,
  });
}
function now() { return performance.now(); }
async function measureGenerator(input: ReturnType<typeof parseRequest>): Promise<{ sample: OneSample; hash: string; bytes: number; files: number; sourceBytes: number }> {
  const start = now();
  const project = await materializeProject(input);
  const materialized = now();
  const entries = [...project.files].map(([path, data]) => ({path, data, executable: isExecutablePath(path)}));
  const zip = createZip(entries);
  const packed = now();
  verifyZipAgainstPlan(zip, project.plan);
  const verified = now();
  return {
    sample: {
      materialize: materialized - start,
      package: packed - materialized,
      verify: verified - packed,
      total: verified - start,
      heapUsedBytes: process.memoryUsage().heapUsed,
      rssBytes: process.memoryUsage().rss,
    },
    hash: checksum(zip), bytes: zip.byteLength, files: project.plan.totals.files,
    sourceBytes: project.plan.totals.bytes,
  };
}
function writeReport(name: string, data: unknown) {
  mkdirSync(OUT, {recursive: true});
  const target = join(OUT, `${name}.json`);
  const tmp = `${target}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`);
  renameSync(tmp, target);
  console.log(`Report: ${target}`);
}
function metadata() {
  return {
    date: new Date().toISOString(), platform: platform(), arch: arch(),
    bun: typeof Bun !== 'undefined' ? Bun.version : null, node: process.versions.node,
    measurement: 'wall-clock monotonic performance.now()',
  };
}
async function generatorBenchmark(presets: string[], runs: number, warmup: number) {
  const results = [];
  for (const preset of presets) {
    console.log(`Generator ${preset}: warmup=${warmup}, measured=${runs}`);
    const input = requestFor(preset);
    const canonical = await generateProject(input); // Production pipeline cross-check, excluded from timings.
    const expectedHash = checksum(canonical.zip);
    const samples: OneSample[] = [];
    let last: Awaited<ReturnType<typeof measureGenerator>> | undefined;
    for (let index = -warmup; index < runs; index++) {
      const measured = await measureGenerator(input);
      if (measured.hash !== expectedHash) throw new Error(`${preset} generated ZIP drift at sample ${index}`);
      if (index >= 0) samples.push(measured.sample);
      last = measured;
    }
    if (!last) throw new Error('No measurements collected');
    const phaseStats = Object.fromEntries((['materialize', 'package', 'verify'] as Phase[]).map((key) => [
      `${key}Ms`, summarize(samples.map((sample) => sample[key])),
    ]));
    results.push({
      preset, status: 'PASS', files: last.files, sourceBytes: last.sourceBytes, zipBytes: last.bytes,
      zipSha256: expectedHash, measuredRuns: runs, warmupRuns: warmup,
      ...phaseStats,
      totalMs: summarize(samples.map((sample) => sample.total)),
      // Snapshots only: these are NOT peak-memory measurements or allocations/operation.
      heapAfterBytes: summarize(samples.map((sample) => sample.heapUsedBytes)),
      rssAfterBytes: summarize(samples.map((sample) => sample.rssBytes)),
    });
    console.log(`  verified ZIP ${last.bytes} B, total median ${summarize(samples.map((sample) => sample.total)).median} ms`);
  }
  writeReport('generator', {
    schemaVersion: 1, kind: 'generator', environment: metadata(),
    memoryNote: 'Post-operation heap/RSS snapshots; not peak memory or allocations.',
    samplesNote: 'Warmup samples excluded. Do not compare timings across different machines/runtimes.',
    results,
  });
}
function sdkLocation() {
  const options = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT,
    join(homedir(), 'Android', 'Sdk'), join(homedir(), 'Library', 'Android', 'sdk')];
  return options.find((sdk) => sdk && existsSync(sdk));
}
function extractProject(zip: Uint8Array, directory: string) {
  mkdirSync(directory, {recursive: true});
  for (const entry of readZip(zip)) {
    const destination = resolve(directory, entry.path);
    const within = relative(directory, destination);
    if (!within || within === '..' || within.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) || isAbsolute(within)) {
      throw new Error(`Generated ZIP contains unsafe path: ${entry.path}`);
    }
    mkdirSync(dirname(destination), {recursive:true});
    writeFileSync(destination, entry.data);
    chmodSync(destination, entry.executable ? 0o755 : 0o644);
  }
}
function gradleCommand(tasks: string[], cwd: string, sdk: string): CommandResult {
  const cmd = process.platform === 'win32' ? (process.env.ComSpec ?? 'cmd.exe') : './gradlew';
  const prefix = process.platform === 'win32' ? ['/d', '/s', '/c', 'gradlew.bat'] : [];
  const start = now();
  const result = spawnSync(cmd, [...prefix, ...tasks, '--no-daemon', '--console=plain'], {
    cwd, env: { ...process.env, ANDROID_HOME:sdk, ANDROID_SDK_ROOT:sdk },
    encoding: 'utf8', timeout: 20 * 60_000, maxBuffer: 16 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'], shell: false,
  });
  const elapsedMs = Math.round(now() - start);
  const message = (result.error?.message || result.stderr?.slice(-1400) || result.stdout?.slice(-1400) || '').trim();
  return {ok: !result.error && result.status === 0, elapsedMs, summary: result.status === 0 ? 'Gradle exited 0' : `exit ${result.status}: ${message}`};
}
async function androidBenchmark(presets: string[], includeRelease: boolean) {
  const sdk = sdkLocation();
  if (!sdk) {
    console.error('BLOCKED: Android SDK not found. Set ANDROID_HOME/ANDROID_SDK_ROOT; no Gradle build attempted.');
    writeReport('android', {schemaVersion: 1, kind: 'android', environment: metadata(),
      results: presets.map((preset) => ({preset, status: 'BLOCKED', detail: 'Android SDK unavailable'}))});
    process.exitCode = 78;
    return;
  }
  const results: unknown[] = [];
  const reportDir = join(OUT, 'android');
  mkdirSync(reportDir, {recursive: true});
  let failed = false;
  for (const preset of presets) {
    const directory = join(reportDir, preset);
    const result: Record<string, unknown> = {preset, status: 'NOT RUN'};
    try {
      // Delete ONLY our fixed preset output folder; never user-supplied directories.
      rmSync(directory, {recursive:true,force:true});
      const generated = await generateProject(requestFor(preset));
      verifyZipAgainstPlan(generated.zip, generated.plan);
      extractProject(generated.zip, directory);
      result.zipBytes = generated.zip.length;
      result.sourceBytes = generated.plan.totals.bytes;
      result.files = generated.plan.totals.files;
      result.zipSha256 = checksum(generated.zip);
      const first = gradleCommand([':app:assembleDebug', ':app:testDebugUnitTest', ':app:lintDebug'], directory, sdk);
      result.firstBuild = first;
      if (!first.ok) throw new Error(`First build failed: ${first.summary}`);
      const apk = join(directory,'app','build','outputs','apk','debug','app-debug.apk');
      if (!existsSync(apk)) throw new Error('Debug APK missing after successful Gradle build');
      result.debugApkBytes = statSync(apk).size;
      const repeated = gradleCommand([':app:assembleDebug', ':app:testDebugUnitTest', ':app:lintDebug'], directory, sdk);
      result.noChangeRepeat = repeated;
      if (!repeated.ok) throw new Error(`No-change repeat failed: ${repeated.summary}`);
      if (includeRelease) {
        const release = gradleCommand([':app:assembleRelease'], directory, sdk);
        result.releaseBuild = release;
        if (!release.ok) throw new Error(`Release build failed: ${release.summary}`);
        const releasePath = join(directory,'app','build','outputs','apk','release','app-release-unsigned.apk');
        if (!existsSync(releasePath)) throw new Error('Expected unsigned release APK missing');
        result.unsignedReleaseApkBytes = statSync(releasePath).size;
      }
      result.status = 'PASS';
      console.log(`${preset}: PASS (first=${first.elapsedMs} ms, no-change=${repeated.elapsedMs} ms, APK=${result.debugApkBytes} B)`);
    } catch (error) {
      result.status = 'FAIL';
      result.failure = String(error);
      console.error(`${preset}: FAIL ${String(error)}`);
      failed = true;
    }
    results.push(result);
  }
  writeReport('android', {
    schemaVersion: 1, kind:'android', environment: metadata(),
    note: 'First build uses a freshly extracted project; shared Gradle/download caches may be warm. No-change repeat is NOT an incremental source rebuild. No device benchmarks or startup measurements.',
    results,
  });
  if (failed) process.exitCode = 1;
}

try {
  const args = parseBenchmarkArgs(process.argv.slice(2));
  if (args.command === 'generator') await generatorBenchmark(args.presets, args.runs, args.warmup);
  else await androidBenchmark(args.presets, args.release);
} catch (error) {
  console.error(`FAIL: ${String(error)}`);
  process.exitCode = 2;
}
