/** Pure integrity classifiers; no SDK, network, Git or filesystem access. */
export const PRESETS = Object.freeze(['compose-minimal', 'compose-starter', 'local-notes', 'catalog-ui']);
export const RUNTIME_PRESETS = Object.freeze(['compose-starter', 'local-notes', 'catalog-ui']);

export function sensitivePath(path) {
  const normalized = path.replaceAll('\\', '/').toLowerCase();
  const parts = normalized.split('/');
  const base = parts.at(-1) ?? '';
  return parts.some((part) => part === '.git' || part === '.gradle') ||
    base === 'local.properties' || base === 'google-services.json' ||
    base === '.env' || base.startsWith('.env.') ||
    /\.(jks|keystore|p12|pfx|pem|key|db|sqlite|sqlite3|apk|aab)$/.test(base);
}

export function checkReleaseEvidence(runtime, android, generator, expectedRuntimeFingerprint) {
  const gates = [];
  const record = (name, status, detail) => gates.push({name, status, detail});
  const runtimeReports = Array.isArray(runtime?.presets) ? runtime.presets : [];
  // Source-bound evidence is required in release checks. Legacy reports remain
  // readable to existing parser tests, but cannot certify a release.
  const strict = typeof expectedRuntimeFingerprint === 'string';
  const invalid = strict && runtime != null && (runtime.kind !== 'android-runtime' || runtime.schemaVersion !== 2);
  const wrongMode = strict && runtime != null && runtime.mode !== 'device';
  const stale = strict && runtime != null && runtime.sourceFingerprint !== expectedRuntimeFingerprint;
  const device = runtime?.device;
  const invalidDevice = strict && (!device || !/^[a-f0-9]{64}$/.test(device.idHash ?? '') ||
    !Number.isInteger(device.apiLevel) || device.apiLevel < 26 ||
    !/^[A-Za-z0-9_-]{2,64}$/.test(device.abi ?? '') ||
    !['emulator', 'physical'].includes(device.kind));
  for (const preset of RUNTIME_PRESETS) {
    const matches = runtimeReports.filter((r) => r?.preset === preset);
    const item = matches[0];
    const checks = item?.checks;
    if (matches.length > 1) record(`runtime:${preset}`, 'FAIL', 'Duplicate preset evidence');
    else if (!item) record(`runtime:${preset}`, 'BLOCKED', 'No device runtime report for this preset');
    else if (invalid) record(`runtime:${preset}`, 'FAIL', 'Invalid runtime evidence kind/version');
    else if (wrongMode) record(`runtime:${preset}`, 'BLOCKED', 'Compilation evidence is not device instrumentation');
    else if (stale) record(`runtime:${preset}`, 'BLOCKED', 'Device evidence does not match current Android source');
    else if (invalidDevice) record(`runtime:${preset}`, 'BLOCKED', 'Device metadata/API/ABI is missing or invalid');
    else if (Object.values(checks ?? {}).some((c) => c?.status === 'FAIL')) {
      record(`runtime:${preset}`, 'FAIL', 'Runtime report includes a failed check');
    } else if (checks?.instrumented?.status === 'PASS' && checks?.gradle?.status === 'PASS' &&
      checks?.unitTests?.status === 'PASS' && checks?.apk?.status === 'PASS' &&
      (!strict || (checks?.['install-app']?.status === 'PASS' && checks?.['install-androidTest']?.status === 'PASS' &&
        Number.isInteger(checks.instrumented.testsExecuted) && checks.instrumented.testsExecuted > 0))) {
      record(`runtime:${preset}`, 'PASS', checks.instrumented.detail || 'Instrumented tests executed successfully');
    } else record(`runtime:${preset}`, 'BLOCKED', `Device instrumentation unverified (${checks?.instrumented?.status ?? 'no result'})`);
  }
  for (const [kind, report] of [['android-builds', android], ['generator-benchmark', generator]]) {
    const expectedKind = kind === 'android-builds' ? 'android' : 'generator';
    const results = Array.isArray(report?.results) ? report.results : [];
    const missing = PRESETS.filter((id) => !results.some((r) => r.preset === id && r.status === 'PASS'));
    const failing = results.some((r) => r.status === 'FAIL');
    record(kind, failing ? 'FAIL' : missing.length ? 'BLOCKED' : 'PASS', failing ? 'Some results failed' : missing.length ? `Missing successful results: ${missing.join(', ')}` : `All ${PRESETS.length} presets reported PASS`);
    if (report && report.kind !== expectedKind) {
      gates.at(-1).status = 'FAIL';
      gates.at(-1).detail = 'Invalid benchmark report kind';
    }
  }
  return {gates, status: gates.some((g) => g.status === 'FAIL') ? 'FAIL' : gates.some((g) => g.status === 'BLOCKED') ? 'BLOCKED' : 'PASS'};
}

export function compareChecksums(actual, expected) {
  if (!/^[a-f0-9]{64}$/.test(expected)) throw new Error('Expected SHA-256 must be lowercase 64-character hex');
  if (actual !== expected) throw new Error(`Patch integrity mismatch: expected ${expected}, got ${actual}`);
  return true;
}

export function validatePatchList(entries) {
  const seen = new Set();
  for (const entry of entries) {
    if (!entry || typeof entry.name !== 'string' || typeof entry.file !== 'string') throw new Error('Invalid patch manifest entry');
    if (seen.has(entry.name)) throw new Error(`Duplicate patch stage: ${entry.name}`);
    seen.add(entry.name);
    if (entry.file.startsWith('/') || entry.file.includes('..') || entry.file.includes('\\')) throw new Error('Unsafe patch file path');
    if (!/^[a-f0-9]{64}$/.test(entry.sha256)) throw new Error(`Invalid checksum for ${entry.name}`);
  }
  return true;
}

/** Release APK evidence is separate from device runtime. Fail-closed on stale/missing results. */
export function checkReleaseApks(report, fingerprint) {
  const entries = Array.isArray(report?.results) ? report.results : [];
  const invalid = report != null && (report.kind !== 'release-audit' || report.schemaVersion !== 1);
  const stale = report != null && report.generatorFingerprint !== fingerprint;
  const gates=[];
  for(const component of ['r8','native']) {
    if(invalid) {gates.push({name:component,status:'FAIL',detail:'Invalid release-audit report kind/version'});continue;}
    if(stale) {gates.push({name:component,status:'BLOCKED',detail:'Release-audit report does not match current embedded templates'});continue;}
    const relevant = PRESETS.map(preset=>entries.find(item=>item.preset===preset));
    const failing = relevant.filter(item=>item?.status==='FAIL' || item?.[component]?.status==='FAIL');
    const missing = PRESETS.filter((preset,i)=>!relevant[i] || relevant[i].status!=='PASS' || relevant[i][component]?.status!=='PASS' || !(relevant[i].releaseApkBytes>0));
    gates.push({name:component,status:failing.length?'FAIL':missing.length?'BLOCKED':'PASS',
      detail:failing.length?`Release audit failed for ${failing.map(item=>item.preset).join(', ')}`:
        missing.length?`Optimized APK evidence missing: ${missing.join(', ')}`:`All ${PRESETS.length} unsigned optimized release APKs passed ${component} checks (static only)`});
  }
  return gates;
}
