import test from 'node:test';
import assert from 'node:assert/strict';
import {checkReleaseEvidence, compareChecksums, sensitivePath, validatePatchList} from './gates.mjs';

test('rejects sensitive paths without rejecting ordinary Kotlin and Gradle files', () => {
  for (const name of ['.env', '.env.production', 'app/local.properties', 'certs/upload.jks', '.git/config', 'app/google-services.json', 'cache/database.sqlite']) assert.equal(sensitivePath(name), true, name);
  for (const name of ['app/src/main/MainActivity.kt', 'gradle/libs.versions.toml', 'README.md', '.env.example']) {
    // .env.example is intentionally blocked until explicitly reviewed; other source files are safe.
    if (name === '.env.example') assert.equal(sensitivePath(name), true);
    else assert.equal(sensitivePath(name), false, name);
  }
});

test('no device evidence remains BLOCKED, even if Gradle compiled instrumented tests', () => {
  const report = {presets: ['compose-starter', 'local-notes', 'catalog-ui'].map(preset => ({preset, checks:{gradle:{status:'PASS'}, unitTests:{status:'PASS'}, apk:{status:'PASS'}, instrumented:{status:'NOT RUN'}}}))};
  const status=checkReleaseEvidence(report, null, null);
  assert.equal(status.status,'BLOCKED');
  assert.equal(status.gates.filter(g => g.name.startsWith('runtime:')).length,3);
});

test('a failed test cannot be hidden by successful APK build', () => {
  const runtime={presets:[{preset:'local-notes',checks:{gradle:{status:'PASS'},unitTests:{status:'FAIL'},apk:{status:'PASS'},instrumented:{status:'NOT RUN'}}}]};
  assert.equal(checkReleaseEvidence(runtime, null, null).status,'FAIL');
});

test('complete device and benchmark evidence is PASS', () => {
  const runtime={presets: ['compose-starter','local-notes','catalog-ui'].map(preset=>({preset,checks:{gradle:{status:'PASS'}, unitTests:{status:'PASS'}, apk:{status:'PASS'}, instrumented:{status:'PASS',detail:'3 executed'}}}))};
  const results=['compose-minimal','compose-starter','local-notes','catalog-ui'].map(preset=>({preset,status:'PASS'}));
  assert.equal(checkReleaseEvidence(runtime,{kind:'android',results},{kind:'generator',results}).status,'PASS');
});

test('wrong report kind fails closed',()=>{
  const results=['compose-minimal','compose-starter','local-notes','catalog-ui'].map(preset=>({preset,status:'PASS'}));
  assert.equal(checkReleaseEvidence(null,{kind:'generator',results},null).status,'FAIL');
});

test('SHA-256 verification rejects corruption', () => {
  const value='a'.repeat(64);assert.equal(compareChecksums(value,value),true);
  assert.throws(()=>compareChecksums('b'.repeat(64),value),/integrity mismatch/);
  assert.throws(()=>compareChecksums(value,'abc'),/SHA-256/);
});

test('patch chain requires unique stages and safe paths',()=>{
  const item={name:'F1.0',file:'patches/one.patch',sha256:'b'.repeat(64)};
  assert.equal(validatePatchList([item]),true);
  assert.throws(()=>validatePatchList([item,item]),/Duplicate/);
  assert.throws(()=>validatePatchList([{...item,file:'../evil.patch'}]),/Unsafe/);
});

test('stale, compile-only or metadata-free device reports cannot authorize a release', () => {
  const fingerprint = 'a'.repeat(64);
  const row = (preset) => ({preset,checks:{gradle:{status:'PASS'}, unitTests:{status:'PASS'}, apk:{status:'PASS'},
    'install-app':{status:'PASS'}, 'install-androidTest':{status:'PASS'},
    instrumented:{status:'PASS',testsExecuted:3}}});
  const report={schemaVersion:2,kind:'android-runtime',mode:'device',sourceFingerprint:fingerprint,
    device:{idHash:'b'.repeat(64),apiLevel:35,abi:'arm64-v8a',kind:'emulator'},
    presets:['compose-starter','local-notes','catalog-ui'].map(row)};
  const results=['compose-minimal','compose-starter','local-notes','catalog-ui'].map(preset=>({preset,status:'PASS'}));
  const check = (r) => checkReleaseEvidence(r,{kind:'android',results},{kind:'generator',results},fingerprint);
  assert.equal(check(report).status,'PASS');
  assert.equal(check({...report,mode:'compile'}).status,'BLOCKED');
  assert.equal(check({...report,sourceFingerprint:'c'.repeat(64)}).status,'BLOCKED');
  assert.equal(check({...report,device:undefined}).status,'BLOCKED');
  assert.equal(check({...report,kind:'wrong'}).status,'FAIL');
  assert.equal(check({...report,presets:[...report.presets,report.presets[0]]}).status,'FAIL');
});

test('instrumentation requires both successful installs and a nonzero test count', () => {
  const fingerprint = 'a'.repeat(64);
  const checks={gradle:{status:'PASS'},unitTests:{status:'PASS'},apk:{status:'PASS'},
    'install-app':{status:'PASS'},'install-androidTest':{status:'PASS'},
    instrumented:{status:'PASS',testsExecuted:3}};
  const base={schemaVersion:2,kind:'android-runtime',mode:'device',sourceFingerprint:fingerprint,
    device:{idHash:'b'.repeat(64),apiLevel:35,abi:'x86_64',kind:'emulator'},
    presets:['compose-starter','local-notes','catalog-ui'].map(preset=>({preset,checks}))};
  assert.equal(checkReleaseEvidence(base,null,null,fingerprint).gates.every(g=>g.name.startsWith('runtime:') ? g.status==='PASS':true),true);
  const insufficient={...base,presets:base.presets.map(p=>({...p,checks:{...checks,instrumented:{status:'PASS',testsExecuted:0}}}))};
  assert.equal(checkReleaseEvidence(insufficient,null,null,fingerprint).gates.filter(g=>g.name.startsWith('runtime:')).every(g=>g.status==='BLOCKED'),true);
  const noTestInstall={...base,presets:base.presets.map(p=>({...p,checks:{...checks,'install-androidTest':undefined}}))};
  assert.equal(checkReleaseEvidence(noTestInstall,null,null,fingerprint).gates.filter(g=>g.name.startsWith('runtime:')).every(g=>g.status==='BLOCKED'),true);
});
