import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { parseAdbDevices, selectOnlineDevice, parseInstrumentationReports, parseInstrumentationOutput } from './devices.mjs';

test('adb parses connected, unauthorized, offline and daemon messages', () => {
  const devices = parseAdbDevices('List of devices attached\nemulator-5554\tdevice product:sdk model:Pixel\n123\tunauthorized\n192.168.1.1:5555 offline\n* daemon started successfully\n');
  assert.equal(devices.length, 3);
  assert.equal(devices[0].serial, 'emulator-5554');
  assert.equal(devices[1].state, 'unauthorized');
  assert.equal(devices[2].state, 'offline');
  assert.equal(selectOnlineDevice(devices), 'emulator-5554');
});
test('multiple online devices require explicit serial', () => {
  const devices = parseAdbDevices('List of devices attached\na device\nb device\n');
  assert.throws(() => selectOnlineDevice(devices), /Multiple online/);
  assert.equal(selectOnlineDevice(devices, 'b'), 'b');
});
test('offline, unknown, and malicious explicit serials are rejected', () => {
  const devices = parseAdbDevices('List of devices attached\na unauthorized\nb offline\n');
  assert.throws(() => selectOnlineDevice(devices, 'a'), /unauthorized/);
  assert.throws(() => selectOnlineDevice(devices, 'c'), /not connected/);
  assert.throws(() => selectOnlineDevice(devices, 'b'), /offline/);
  assert.throws(() => selectOnlineDevice(devices, 'a;exit 1'), /Invalid/);
  assert.throws(() => selectOnlineDevice(devices), /No authorized/);
});
test('rejects duplicate serials', () => {
  assert.throws(() => parseAdbDevices('a device\na offline'), /duplicate/);
});
test('instrumentation reports require actual successful executed tests', () => {
  assert.deepEqual(parseInstrumentationReports(['<testsuite tests="2" failures="0" errors="0" skipped="0"></testsuite>']).tests, 2);
  assert.throws(() => parseInstrumentationReports([]), /No executed/);
  assert.throws(() => parseInstrumentationReports(['<testsuite tests="0" failures="0" errors="0"></testsuite>']), /No executed/);
  assert.throws(() => parseInstrumentationReports(['<testsuite tests="2" failures="1" errors="0"></testsuite>']), /failures/);
  assert.throws(() => parseInstrumentationReports(['<testsuite tests="2" failures="0" errors="0" skipped="1"></testsuite>']), /skipped/);
});

test('android instrumentation output must contain a successful nonempty runner result', () => {
  assert.deepEqual(parseInstrumentationOutput('Time: 0.3\nOK (4 tests)\nINSTRUMENTATION_CODE: -1'), {tests: 4});
  assert.throws(() => parseInstrumentationOutput('FAILURES!!!\nINSTRUMENTATION_CODE: -1'), /failure/);
  assert.throws(() => parseInstrumentationOutput('INSTRUMENTATION_CODE: -1'), /No successful/);
  assert.throws(() => parseInstrumentationOutput('OK (0 tests)\nINSTRUMENTATION_CODE: -1'), /No successful/);
});

test('instrumentation uses the non-raw runner summary and explicit serial', async () => {
  const {instrumentationArgs} = await import('./devices.mjs');
  assert.deepEqual(instrumentationArgs('emulator-5554', 'dev.example.test'), [
    '-s', 'emulator-5554', 'shell', 'am', 'instrument', '-w',
    'dev.example.test/androidx.test.runner.AndroidJUnitRunner',
  ]);
  assert.throws(() => instrumentationArgs('bad;command', 'dev.example.test'), /Invalid/);
  assert.throws(() => instrumentationArgs('emulator-5554', 'bad;component'), /Invalid/);
});
