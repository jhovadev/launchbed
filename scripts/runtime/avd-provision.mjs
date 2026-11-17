#!/usr/bin/env node
/** Explicit, no-download Android SDK AVD provisioning for CLI-first development. */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const USAGE = `Launchbed CLI AVD provisioning (no Android Studio required)
  node scripts/runtime/avd-provision.mjs images
      List system images already installed in the Android SDK (read-only).
  AVD_NAME=Launchbed_API36 AVD_IMAGE='system-images;android-36;google_apis;x86_64' \\
      node scripts/runtime/avd-provision.mjs create
      Create one named AVD from an ALREADY INSTALLED image (explicit action).
      Optional AVD_PROFILE=pixel_7, if your avdmanager supports that device ID.
  just emulator-list; AVD_NAME=Launchbed_API36 just emulator-start
      Start and inspect; neither action downloads packages.
If no images are installed, use the official Android SDK manager manually:
  sdkmanager --list | grep system-images
  sdkmanager --install 'system-images;android-36;google_apis;x86_64' emulator
  sdkmanager --licenses
Replace the example package with an image actually available for your host.
No commands here install SDK packages, accept licenses, start AVDs, or run ADB.
`;

export function validateAvdName(name) {
  if (typeof name !== 'string' || !/^[A-Za-z][A-Za-z0-9._-]{0,63}$/.test(name)) {
    throw new Error('AVD_NAME must start with a letter and contain only A-Z, 0-9, dot, underscore or hyphen (1–64 characters).');
  }
  if (name === '.' || name === '..') throw new Error('Invalid AVD_NAME');
  return name;
}
export function validateImagePackage(id) {
  if (typeof id !== 'string') throw new Error('AVD_IMAGE is required');
  const match = /^system-images;android-(\d+)(?:\.\d+)?;[A-Za-z0-9_.-]+;(?:x86_64|x86|arm64-v8a|armeabi-v7a)$/.exec(id);
  if (!match || Number(match[1]) < 26) throw new Error('AVD_IMAGE must be a complete Android system image package with API >= 26.');
  return id;
}
export function parseInstalledImages(output) {
  const result = new Set();
  for (const line of String(output).split(/\r?\n/)) {
    const first = line.trim().split(/\s+\|\s+/)[0]?.trim();
    if (!first) continue;
    try { result.add(validateImagePackage(first)); } catch { /* not an installed image row */ }
  }
  return [...result].sort();
}
export function createAvdArgs(name, image, profile) {
  const args = ['create', 'avd', '-n', validateAvdName(name), '-k', validateImagePackage(image)];
  if (profile != null && profile !== '') args.push('-d', validateAvdName(profile));
  return args;
}
export function parseAvdNames(output) {
  return String(output).split(/\r?\n/).map((line)=>line.trim()).filter((name)=>/^[A-Za-z][A-Za-z0-9._-]{0,63}$/.test(name));
}

function sdkHome() {
  for (const dir of [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT,
    join(homedir(), 'Android', 'Sdk'), join(homedir(), 'Library', 'Android', 'sdk')]) {
    if (dir && existsSync(dir)) return dir;
  }
  throw new Error('Android SDK not found; set ANDROID_HOME to the SDK root.');
}
function commandLineTool(sdk, name) {
  const exe = process.platform === 'win32' ? `${name}.bat` : name;
  const toolsRoot = join(sdk, 'cmdline-tools');
  if (existsSync(toolsRoot)) {
    const versions = readdirSync(toolsRoot).filter((d) => {
      try { return statSync(join(toolsRoot, d)).isDirectory(); } catch { return false; }
    }).sort((a, b) => a === 'latest' ? -1 : b === 'latest' ? 1 : b.localeCompare(a, undefined, {numeric: true}));
    for (const version of versions) {
      const full = join(toolsRoot, version, 'bin', exe);
      if (existsSync(full)) return full;
    }
  }
  return exe;
}
function execute(binary, args, {input, timeout = 60_000} = {}) {
  const output = spawnSync(binary, args, { shell:false, encoding:'utf8', input, timeout, maxBuffer:4*1024*1024 });
  if (output.error || output.status !== 0) {
    const reason = output.error?.message || output.stderr?.trim() || output.stdout?.trim() || `exit ${output.status}`;
    throw new Error(`${binary} failed: ${String(reason).slice(0,1400)}`);
  }
  return output.stdout || '';
}
export function main(argv=process.argv.slice(2)) {
  const [verb, ...rest] = argv;
  if (rest.length || !['help','images','create'].includes(verb || 'help')) {
    console.error(USAGE);return 2;
  }
  if (!verb || verb === 'help') { console.log(USAGE);return 0; }
  try {
    const sdk = sdkHome();
    const sdkmanager = commandLineTool(sdk, 'sdkmanager');
    const installed = parseInstalledImages(execute(sdkmanager, ['--list_installed']));
    if (verb === 'images') {
      console.log(installed.length ? installed.join('\n') : 'No installed compatible system images. Use sdkmanager to install one explicitly.');
      return 0;
    }
    const name = validateAvdName(process.env.AVD_NAME);
    const image = validateImagePackage(process.env.AVD_IMAGE);
    if (!installed.includes(image)) throw new Error(`AVD_IMAGE ${image} is not installed. Use 'just emulator-images' to list installed images. No downloads attempted.`);
    const emulator = process.platform === 'win32' ? 'emulator.exe' : 'emulator';
    const sdkEmulator = join(sdk,'emulator',emulator);
    const avds = parseAvdNames(execute(existsSync(sdkEmulator) ? sdkEmulator : emulator, ['-list-avds'], {timeout:15_000}));
    if (avds.includes(name)) throw new Error(`AVD ${name} already exists; refusing to replace it.`);
    const avdmanager = commandLineTool(sdk, 'avdmanager');
    const args = createAvdArgs(name, image, process.env.AVD_PROFILE);
    execute(avdmanager, args, {input:'no\n', timeout:120_000});
    const created = parseAvdNames(execute(existsSync(sdkEmulator) ? sdkEmulator : emulator, ['-list-avds'], {timeout:15_000}));
    if (!created.includes(name)) throw new Error(`avdmanager exited successfully but ${name} is missing from emulator -list-avds.`);
    console.log(`PASS: Created AVD ${name} from already installed image ${image}. To start: AVD_NAME=${name} just emulator-start`);
    return 0;
  } catch(err) {console.error(`BLOCKED: ${err.message}`);return 78;}
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
