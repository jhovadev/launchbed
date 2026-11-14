import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDeviceReadiness} from './device-readiness.mjs';
import {runtimeSourceFingerprint} from './source-fingerprint.mjs';
import {mkdtempSync, mkdirSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

test('booted authorized device with API >= minSdk is accepted', () => {
  assert.deepEqual(parseDeviceReadiness({bootCompleted:'1\n',apiLevel:' 35\n',abi:'arm64-v8a\n'}),
    {apiLevel:35,abi:'arm64-v8a',bootCompleted:true});
});
test('connected ADB before boot completion is not ready', () => {
  assert.throws(()=>parseDeviceReadiness({bootCompleted:'0',apiLevel:'35',abi:'arm64-v8a'}),/not completed boot/);
});
test('API below minSdk or unreadable is rejected', () => {
  for (const apiLevel of ['25','unknown','', '35;rm','999']) {
    assert.throws(()=>parseDeviceReadiness({bootCompleted:'1',apiLevel,abi:'arm64-v8a'}));
  }
});
test('invalid or empty ABI fails closed', () => {
  for (const abi of ['','../../unsafe','arm64-v8a;rm'])
    assert.throws(()=>parseDeviceReadiness({bootCompleted:'1',apiLevel:'35',abi}));
});
test('runtime fingerprint is deterministic and changes on source modification', () => {
  const root=mkdtempSync(join(tmpdir(),'f16e-fingerprint-'));
  try {
    // The fingerprint expects exactly the real source roots; create minimal fixtures.
    const folders=['packages/schema/src','packages/catalog/src','packages/resolver/src',
      'packages/generator/src','packages/design-tokens/src','addons','presets','templates',
      'examples','scripts/runtime'];
    for (const folder of folders) mkdirSync(join(root,folder),{recursive:true});
    writeFileSync(join(root,'examples/basic.json'),'{}');
    writeFileSync(join(root,'scripts/android-runtime.ts'),'source');
    const before=runtimeSourceFingerprint(root);
    assert.match(before,/^[a-f0-9]{64}$/);
    assert.equal(before,runtimeSourceFingerprint(root));
    writeFileSync(join(root,'templates','New.kt'),'class New {}');
    assert.notEqual(before,runtimeSourceFingerprint(root));
  } finally {rmSync(root,{recursive:true,force:true});}
});
