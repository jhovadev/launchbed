#!/usr/bin/env bun
/** F1.6A Android runtime harness. No emulator creation/downloads; device runs require --run. */
import { spawnSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync, readdirSync, chmodSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateProject, parseRequest, readZip, verifyZipAgainstPlan } from '@android-initializr/generator';
import { parseAdbDevices, selectOnlineDevice, parseInstrumentationReports, parseInstrumentationOutput, instrumentationArgs } from './runtime/devices.mjs';
import { parseDeviceReadiness } from './runtime/device-readiness.mjs';
import { runtimeSourceFingerprint } from './runtime/source-fingerprint.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PRESETS = ['compose-minimal', 'compose-starter', 'local-notes', 'catalog-ui'] as const;
type Preset = typeof PRESETS[number];
type Status = 'PASS' | 'FAIL' | 'BLOCKED' | 'NOT RUN';
interface Check { status: Status; detail: string; durationMs?: number; testsExecuted?: number }
interface PresetReport { preset: string; zipBytes?: number; apkBytes?: number; files?: number; checks: Record<string, Check> }
interface DeviceFacts { idHash: string; apiLevel: number; abi: string; kind: 'emulator' | 'physical' }

const USAGE = `Usage: bun run scripts/android-runtime.ts <command> [options]
  doctor                       Print SDK / ADB / emulator availability (read-only)
  devices                      Print all ADB device states (read-only)
  device-check [--serial ID]   Check boot/API/ABI on one authorized device (read-only)
  emulator-list                List installed AVDs (read-only)
  emulator-start               Start AVD named in AVD_NAME (explicit action)
  emulator-stop [--serial ID]  Stop an online emulator (explicit action)
  test [--preset ID | --all] [--run] [--serial ID]
     By default builds APK, JVM tests, lint and instrumented test APK (if present).
     --run executes connectedDebugAndroidTest; requires one authorized device.
     --serial or ANDROID_SERIAL selects a specific device (required with multiple).
     Output under build/runtime-verification/; JSON report written even on failures.
No emulator creation or SDK downloads are performed.
`;

function argsOf(argv: string[]): { command: string; preset: Preset | undefined; all: boolean; run: boolean; serial?: string } {
  const [command = 'help', ...rest] = argv;
  let preset: Preset | undefined; let all = false; let run = false; let serial: string | undefined;
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg === '--all') { all = true; continue; }
    if (arg === '--run') { run = true; continue; }
    if (arg === '--preset' || arg === '--serial') {
      const value = rest[++i];
      if (!value || value.startsWith('--')) throw new Error(`${arg} requires a value`);
      if (arg === '--preset') {
        if (!(PRESETS as readonly string[]).includes(value)) throw new Error(`Unsupported preset ${value}; use ${PRESETS.join(', ')}`);
        preset = value as Preset;
      } else serial = value;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }
  if (preset && all) throw new Error('Use either --preset or --all.');
  return { command, preset, all, run, serial };
}

function runCmd(cmd: string, args: string[], opts: {cwd?: string; env?: NodeJS.ProcessEnv; timeout?: number; quiet?: boolean} = {}) {
  const start = performance.now();
  const result = spawnSync(cmd, args, { cwd: opts.cwd, env: opts.env ?? process.env, encoding: 'utf8',
    stdio: opts.quiet ? ['ignore','pipe','pipe'] : ['ignore','pipe','pipe'],
    timeout: opts.timeout ?? 120_000, maxBuffer: 8 * 1024 * 1024, shell: false });
  const elapsed = Math.round(performance.now() - start);
  return { ok: result.status === 0 && !result.error, code: result.status, stdout: result.stdout || '',
    stderr: result.stderr || '', error: result.error?.message, durationMs: elapsed };
}
function tool(name: string, sdk?: string): string {
  const dir = sdk && (name === 'adb' ? 'platform-tools' : 'emulator');
  const exe = process.platform === 'win32' ? `${name}.exe` : name;
  if (dir && existsSync(join(sdk!, dir, exe))) return join(sdk!, dir, exe);
  return name;
}
function sdkLocation(): string | undefined {
  for (const candidate of [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT,
    join(homedir(), 'Android', 'Sdk'), join(homedir(), 'Library', 'Android', 'sdk')]) {
    if (candidate && existsSync(candidate)) return candidate;
  }
  return undefined;
}
function getDevices(sdk?: string) {
  const result = runCmd(tool('adb', sdk), ['devices', '-l'], { timeout: 15_000, quiet: true });
  if (!result.ok) throw new Error(`adb devices failed: ${result.error || result.stderr.trim() || result.code}`);
  return parseAdbDevices(result.stdout);
}
function devicePreflight(sdk: string, serial: string): DeviceFacts {
  const adb = tool('adb', sdk);
  function getprop(name: string): string {
    const result = runCmd(adb, ['-s', serial, 'shell', 'getprop', name], { timeout: 15_000, quiet: true });
    if (!result.ok) throw new Error(`Cannot read ${name}: ${result.error || result.stderr.trim() || result.code}`);
    return result.stdout.trim();
  }
  const facts = parseDeviceReadiness({
    bootCompleted: getprop('sys.boot_completed'),
    apiLevel: getprop('ro.build.version.sdk'),
    abi: getprop('ro.product.cpu.abi'),
  }, 26);
  return {
    idHash: createHash('sha256').update(serial).digest('hex'),
    apiLevel: facts.apiLevel, abi: facts.abi,
    kind: /^emulator-\d+$/.test(serial) ? 'emulator' : 'physical',
  };
}
function collectXml(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const result: string[] = [];
  function walk(base: string) {
    for (const name of readdirSync(base).sort()) {
      const filename = join(base, name);
      const stats = statSync(filename);
      if (stats.isDirectory()) walk(filename);
      else if (name.toLowerCase().endsWith('.xml') && name.startsWith('TEST')) result.push(readFileSync(filename, 'utf8'));
    }
  }
  walk(dir);
  return result;
}
function checkOutput(label: string, result: ReturnType<typeof runCmd>): Check {
  if (!result.ok) {
    console.error(`${label} FAIL: ${result.error || result.stderr.trim().slice(-1400) || result.code}`);
    return { status: 'FAIL', detail: result.error || `exit ${result.code}: ${result.stderr.trim().slice(-500)}`, durationMs: result.durationMs };
  }
  console.log(`${label}: PASS (${result.durationMs} ms)`);
  return { status: 'PASS', detail: 'Gradle exited 0', durationMs: result.durationMs };
}
function unzipGeneratedProject(preset: Preset, out: string): {zipBytes: number; files: number; instrumented: boolean} {
  const seed = JSON.parse(readFileSync(join(ROOT, 'examples/basic.json'), 'utf8')) as Record<string, unknown>;
  const input = parseRequest({ ...seed, projectName: `Runtime ${preset}`, preset, addons: [],
    applicationId: `dev.initializr.runtime.${preset.replaceAll('-', '')}`,
    namespace: `dev.initializr.runtime.${preset.replaceAll('-', '')}` });
  const project = generateProject(input);
  verifyZipAgainstPlan(project.zip, project.plan);
  const entries = readZip(project.zip);
  if (!entries.length) throw new Error('Generator produced an empty ZIP.');
  mkdirSync(out, { recursive: true });
  for (const entry of entries) {
    const dest = resolve(out, entry.path);
    const subpath = relative(out, dest);
    if (!subpath || subpath.startsWith('..') || isAbsolute(subpath)) throw new Error(`Unsafe generated path: ${entry.path}`);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, entry.data);
    chmodSync(dest, entry.executable ? 0o755 : 0o644);
  }
  return { zipBytes: project.zip.byteLength, files: entries.length,
    instrumented: entries.some((entry) => entry.path.startsWith('app/src/androidTest/') && entry.path.endsWith('.kt')) };
}
function runPreset(preset: Preset, sdk: string, serial?: string): PresetReport {
  const dir = resolve(ROOT, 'build', 'runtime-verification', preset);
  const checks: Record<string, Check> = {};
  const report: PresetReport = { preset, checks };
  // Only a fixed, whitelisted build directory is erased. No user-supplied paths.
  rmSync(dir, { recursive: true, force: true });
  let instrumented = false;
  try {
    const generated = unzipGeneratedProject(preset, dir);
    report.zipBytes = generated.zipBytes; report.files = generated.files;
    instrumented = generated.instrumented;
    checks.generation = { status: 'PASS', detail: `${generated.files} files; ${generated.zipBytes} ZIP bytes` };
  } catch (err) {
    checks.generation = { status: 'FAIL', detail: String(err) }; return report;
  }
  // Windows requires cmd.exe for .bat wrappers; all Gradle arguments below are hardcoded.
  const gradlew = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : './gradlew';
  const wrapperPrefix = process.platform === 'win32' ? ['/d', '/s', '/c', 'gradlew.bat'] : [];
  const env = { ...process.env, ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk,
    ...(serial ? {ANDROID_SERIAL:serial} : {}) };
  const tasks = [':app:assembleDebug', ':app:testDebugUnitTest', ':app:lintDebug',
    ...(instrumented ? [':app:assembleDebugAndroidTest'] : [])];
  const gradle = runCmd(gradlew, [...wrapperPrefix, ...tasks, '--no-daemon', '--console=plain'], {cwd:dir, env, timeout: 15 * 60_000});
  checks.gradle = checkOutput(`${preset} Gradle`, gradle);
  if (!gradle.ok) { checks.instrumented = {status:'NOT RUN',detail:'Gradle failed'}; return report; }
  const apk = join(dir,'app/build/outputs/apk/debug/app-debug.apk');
  if (!existsSync(apk)) {
    checks.apk = {status:'FAIL',detail:'Gradle returned zero but app-debug.apk is missing'};
    return report;
  }
  report.apkBytes = statSync(apk).size;
  checks.apk = {status:'PASS',detail:`${report.apkBytes} bytes`};
  const unitXml = collectXml(join(dir,'app/build/test-results/testDebugUnitTest'));
  try {
    const result = parseInstrumentationReports(unitXml);
    checks.unitTests = {status:'PASS',detail:`${result.tests} JVM tests; 0 failures or errors`};
  } catch (err) {
    checks.unitTests = {status:'FAIL',detail:String(err)};
    return report;
  }
  if (!instrumented) {
    checks.instrumented = {status:'NOT RUN',detail:'No androidTest source in this preset'};
    return report;
  }
  const testApk = join(dir, 'app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk');
  if (!existsSync(testApk)) {
    checks.instrumented = {status:'FAIL',detail:'Instrumentation test APK missing after assembleDebugAndroidTest'};
    return report;
  }
  if (!serial) {
    checks.instrumented = {status:'NOT RUN',detail:'Instrumented APK built; use --run with an authorized device to execute'};
    return report;
  }
  // Install and run on ONE explicit serial. Gradle connectedDebugAndroidTest may use all attached devices.
  const adb = tool('adb',sdk);
  for (const [label, artifact] of [['app',apk], ['androidTest',testApk]] as const) {
    const installed = runCmd(adb,['-s',serial,'install','-r',artifact],{timeout:120_000});
    checks[`install-${label}`] = checkOutput(`${preset} install ${label} on ${serial}`, installed);
    if (!installed.ok) {checks.instrumented={status:'FAIL',detail:`Installation failed: ${label}`};return report;}
  }
  const testPackage = `dev.initializr.runtime.${preset.replaceAll('-', '')}.test`;
  const execution=runCmd(adb,instrumentationArgs(serial, testPackage),{timeout:15*60_000});
  const log=join(dir,'instrumentation-output.txt');
  writeFileSync(log, `${execution.stdout}\n${execution.stderr}`);
  if (!execution.ok) {
    checks.instrumented={status:'FAIL',detail:`adb instrumentation failed, see ${log}`};return report;
  }
  try {
    const parsed=parseInstrumentationOutput(execution.stdout);
    checks.instrumented={status:'PASS',detail:`${parsed.tests} executed on explicitly selected device; full output in instrumentation-output.txt`,durationMs:execution.durationMs,testsExecuted:parsed.tests};
  } catch (err) {
    checks.instrumented={status:'FAIL',detail:`${String(err)}; inspect ${log}`};
  }
  return report;
}

function finishReport(reports: PresetReport[], device?: DeviceFacts): never {
  const dest = join(ROOT,'build/runtime-verification/report.json');
  mkdirSync(dirname(dest),{recursive:true});
  const result = {schemaVersion:2, kind:'android-runtime', mode:device?'device':'compile',
    sourceFingerprint:runtimeSourceFingerprint(ROOT), timestamp:new Date().toISOString(),
    environment:{platform:process.platform, architecture:process.arch, sdk:sdkLocation() ?? null},
    ...(device ? {device} : {}), presets:reports};
  writeFileSync(dest,JSON.stringify(result,null,2)+'\n');
  // Compilation-only runs must not erase previously successful device evidence.
  // An attempted device run (including FAIL) replaces the previous device report.
  if (device) writeFileSync(join(ROOT,'build/runtime-verification/device-report.json'),JSON.stringify(result,null,2)+'\n');
  console.log(`Runtime report: ${dest}`);
  for (const item of reports) {
    console.log(`${item.preset}: ${Object.entries(item.checks).map(([k,v])=>`${k}=${v.status}`).join(', ')}`);
  }
  if (reports.some((item)=>Object.values(item.checks).some((v)=>v.status==='FAIL'))) process.exit(1);
  if (device && !reports.some(item=>item.checks.instrumented?.status==='PASS')) process.exit(78);
  process.exit(0);
}

function main() {
  let options: ReturnType<typeof argsOf>;
  try { options = argsOf(process.argv.slice(2)); }
  catch (err) {console.error(String(err));console.error(USAGE);process.exit(2);}
  const sdk = sdkLocation();
  if (options.command === 'help') { console.log(USAGE); return; }
  if (options.command === 'doctor') {
    console.log(`SDK: ${sdk ?? 'MISSING'}`);
    for (const [name, bin, flags] of [
      ['Java','java',['-version']], ['ADB',tool('adb',sdk),['version']],
      ['Emulator',tool('emulator',sdk),['-version']]] as const) {
      const probe=runCmd(bin,[...flags],{quiet:true,timeout:10_000});
      console.log(`${name}: ${probe.ok ? 'PASS' : 'BLOCKED'} ${probe.ok ? (probe.stdout || probe.stderr).trim().split('\n')[0] : (probe.error || probe.stderr.trim()).slice(0,180)}`);
    }
    return;
  }
  if (options.command === 'devices') {
    try {for (const device of getDevices(sdk)) console.log(`${device.serial}\t${device.state}\t${device.detail}`);}
    catch (err) {console.error(String(err));process.exit(78);}
    return;
  }
  if (options.command === 'device-check') {
    if (!sdk) {console.error('BLOCKED: Android SDK missing.');process.exit(78);}
    try {
      const serial = selectOnlineDevice(getDevices(sdk), options.serial ?? process.env.ANDROID_SERIAL);
      const info = devicePreflight(sdk, serial);
      console.log(`PASS: ${serial} booted, API ${info.apiLevel}, ABI ${info.abi} (${info.kind}); no apps installed.`);
    } catch (err) {console.error(`BLOCKED: ${String(err)}`);process.exit(78);}
    return;
  }
  if (options.command === 'emulator-list') {
    const result=runCmd(tool('emulator',sdk),['-list-avds'],{timeout:15_000,quiet:true});
    if (!result.ok) {console.error(`BLOCKED emulator-list: ${result.error || result.stderr}`);process.exit(78);}
    console.log(result.stdout.trim() || 'No AVDs installed.');return;
  }
  if (options.command === 'emulator-start') {
    const name=process.env.AVD_NAME;
    if (!name || !/^[A-Za-z0-9._-]+$/.test(name)) {console.error('Set AVD_NAME to an installed AVD name.');process.exit(2);}
    const candidates=runCmd(tool('emulator',sdk),['-list-avds'],{timeout:15_000,quiet:true});
    if (!candidates.ok || !candidates.stdout.split(/\r?\n/).includes(name)) {
      console.error(`BLOCKED: AVD ${name} is not installed.`);process.exit(78);
    }
    const child=spawn(tool('emulator',sdk),['-avd',name],{detached:true,stdio:'ignore',shell:false});
    child.on('error',(err)=>console.error(`Failed to launch emulator: ${err.message}`));
    child.unref();console.log(`Emulator process requested for ${name}; verify adb devices -l before testing.`);return;
  }
  if (options.command === 'emulator-stop') {
    let serial: string;
    try {serial=selectOnlineDevice(getDevices(sdk),options.serial ?? process.env.ANDROID_SERIAL);}
    catch(err){console.error(`BLOCKED: ${String(err)}`);process.exit(78);}
    if (!/^emulator-\d+$/.test(serial)) {console.error(`Refusing to stop non-emulator device ${serial}`);process.exit(2);}
    const stop=runCmd(tool('adb',sdk),['-s',serial,'emu','kill'],{timeout:15_000});
    if (!stop.ok) {console.error(stop.stderr);process.exit(1);}
    console.log(`Stop requested for emulator ${serial}`);return;
  }
  if (options.command !== 'test') {console.error(USAGE);process.exit(2);}
  if (!sdk) {console.error('BLOCKED: Android SDK missing. Install SDK and set ANDROID_HOME.');process.exit(78);}
  let serial: string | undefined;
  let device: DeviceFacts | undefined;
  if (options.run) {
    try {
      serial=selectOnlineDevice(getDevices(sdk),options.serial ?? process.env.ANDROID_SERIAL);
      device=devicePreflight(sdk,serial);
      console.log(`Device ready: ${serial}, API ${device.apiLevel}, ABI ${device.abi}; instrumented execution requested.`);
    } catch(err){console.error(`BLOCKED: ${String(err)}`);process.exit(78);}
  } else if (options.serial) {
    console.error('--serial requires --run.');process.exit(2);
  }
  const presets = options.all ? PRESETS : [options.preset ?? 'local-notes'];
  const reports: PresetReport[] = [];
  for (const preset of presets) reports.push(runPreset(preset, sdk, serial));
  finishReport(reports, device);
}
main();
