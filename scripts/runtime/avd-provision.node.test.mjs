import { test } from 'node:test';
import assert from 'node:assert/strict';
import {validateAvdName, validateImagePackage, parseInstalledImages, createAvdArgs, parseAvdNames, main} from './avd-provision.mjs';

test('AVD names are restricted and cannot inject flags or paths', () => {
  assert.equal(validateAvdName('Launchbed_API36'), 'Launchbed_API36');
  for (const value of ['../data', '', '-wipe-data', 'name name', 'x\n--force', '💣', 'a'.repeat(65), undefined]) {
    assert.throws(() => validateAvdName(value));
  }
});
test('installed image package must be complete and supported', () => {
  assert.equal(validateImagePackage('system-images;android-36;google_apis;x86_64'), 'system-images;android-36;google_apis;x86_64');
  assert.equal(validateImagePackage('system-images;android-37.0;google_apis_playstore;arm64-v8a'), 'system-images;android-37.0;google_apis_playstore;arm64-v8a');
  for (const value of ['system-images;android-25;default;x86_64', 'system-images;android-36;google_apis', 'system-images;android-36;foo;arm64-v8a;--force', 'x;android-36;google_apis;x86_64', undefined]) assert.throws(() => validateImagePackage(value));
});
test('sdkmanager installed package table is parsed, ignoring available-only packages and warnings', () => {
  const output='Loading package information...\nInstalled packages:\n  Path | Version | Description\n  system-images;android-36;google_apis;x86_64 | 10 | Google APIs\n  platforms;android-36 | 3 | Platform\n  system-images;android-36;google_apis;x86_64 | 10 | duplicate\n';
  assert.deepEqual(parseInstalledImages(output), ['system-images;android-36;google_apis;x86_64']);
});
test('AVD create args are exact and require no force/replacement option', () => {
  assert.deepEqual(createAvdArgs('Launchbed_API36', 'system-images;android-36;google_apis;x86_64'), ['create','avd','-n','Launchbed_API36','-k','system-images;android-36;google_apis;x86_64']);
  assert.deepEqual(createAvdArgs('Launchbed_API36','system-images;android-36;google_apis;x86_64','pixel_7').slice(-2), ['-d','pixel_7']);
});
test('AVD list ignores headers and flags', () => {
  assert.deepEqual(parseAvdNames('Launchbed_API36\n-other\nPixel_7\n\n'), ['Launchbed_API36','Pixel_7']);
});
test('help never calls SDK or performs side effects', () => {
  assert.equal(main(['help']), 0);
  assert.equal(main(['images','--install']), 2);
});
