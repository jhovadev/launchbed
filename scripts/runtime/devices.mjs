/** Pure ADB parsing / selection functions; no device access, no side effects. */
export function parseAdbDevices(stdout) {
  const devices = [];
  const seen = new Set();
  for (const raw of stdout.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('List of devices attached') || line.startsWith('* daemon')) continue;
    const match = /^(\S+)\s+(device|offline|unauthorized|recovery|sideload|no permissions)(?=\s|$)/.exec(line);
    if (!match) continue;
    const serial = match[1];
    if (seen.has(serial)) throw new Error(`ADB returned duplicate serial: ${serial}`);
    seen.add(serial);
    devices.push({ serial, state: match[2], detail: line.slice(match[0].length).trim() });
  }
  return devices;
}

export function selectOnlineDevice(devices, preferred) {
  if (preferred !== undefined && preferred !== '') {
    if (!/^[A-Za-z0-9._:-]+$/.test(preferred)) throw new Error('Invalid ANDROID_SERIAL/--serial; expected an ADB serial.');
    const matched = devices.find((entry) => entry.serial === preferred);
    if (!matched) throw new Error(`Selected device ${preferred} is not connected. Check adb devices -l.`);
    if (matched.state !== 'device') throw new Error(`Selected device ${preferred} is ${matched.state}, not authorized/online.`);
    return matched.serial;
  }
  const online = devices.filter((entry) => entry.state === 'device');
  if (online.length === 1) return online[0].serial;
  if (online.length === 0) throw new Error('No authorized online Android device. Check adb devices -l.');
  throw new Error(`Multiple online Android devices (${online.map((device) => device.serial).join(', ')}). Set ANDROID_SERIAL or pass --serial.`);
}

export function parseInstrumentationReports(xmlDocuments) {
  let suites = 0, tests = 0, errors = 0, failures = 0, skipped = 0;
  for (const xml of xmlDocuments) {
    // Only the root suite(s) are counted. Nested test suites are not summed twice.
    const match = /<testsuite\b([^>]*)>/i.exec(xml);
    if (!match) continue;
    const attrs = Object.fromEntries([...(match[1] ?? "").matchAll(/([\w-]+)="([^"]*)"/g)].map(([,key,value]) => [key,value]));
    const asCount = (key) => {
      const value = attrs[key];
      if (value === undefined || !/^\d+$/.test(value)) throw new Error(`Invalid test report: missing ${key} attribute`);
      return Number(value);
    };
    suites++;
    tests += asCount('tests'); errors += asCount('errors'); failures += asCount('failures');
    skipped += attrs.skipped === undefined ? 0 : asCount('skipped');
  }
  if (!suites || !tests) throw new Error('No executed instrumentation tests found in XML output.');
  if (errors || failures || skipped) throw new Error(`Instrumentation results: ${failures} failures, ${errors} errors, ${skipped} skipped.`);
  return { suites, tests, errors, failures, skipped };
}

/** Parses the AndroidJUnitRunner -w -r terminal summary. Fail closed. */
export function parseInstrumentationOutput(stdout) {
  if (/FAILURES!!!|INSTRUMENTATION_FAILED|INSTRUMENTATION_ABORTED|Process crashed|shortMsg=/i.test(stdout)) {
    throw new Error('Instrumentation runner reported failure or crash.');
  }
  const match = /\bOK \((\d+) tests?\)/.exec(stdout);
  if (!match || Number(match[1]) < 1 || !/INSTRUMENTATION_CODE:\s*-1\b/.test(stdout)) {
    throw new Error('No successful AndroidJUnitRunner summary with executed tests.');
  }
  return { tests: Number(match[1]) };
}

/** Use AndroidJUnitRunner's human-readable summary: -r (raw) omits that format. */
export function instrumentationArgs(serial, testPackage) {
  if (!/^[A-Za-z0-9._:-]+$/.test(serial) || !/^[a-zA-Z_][\w]*(?:\.[a-zA-Z_][\w]*)+$/.test(testPackage)) {
    throw new Error('Invalid instrumentation target');
  }
  return ['-s', serial, 'shell', 'am', 'instrument', '-w',
    `${testPackage}/androidx.test.runner.AndroidJUnitRunner`];
}
