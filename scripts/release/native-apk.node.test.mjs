import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectApkBytes} from './native-apk.mjs';
import {checkReleaseApks, PRESETS} from '../integrity/gates.mjs';

function elf(alignment=16384){
  const b=Buffer.alloc(120);
  b.write('\x7fELF',0,'latin1');b[4]=2;b[5]=1;b[6]=1;
  b.writeBigUInt64LE(64n,32);b.writeUInt16LE(56,54);b.writeUInt16LE(1,56);
  b.writeUInt32LE(1,64);b.writeBigUInt64LE(BigInt(alignment),64+48);
  return b;
}
function zip(filename, data, align=false) {
  const name=Buffer.from(filename);
  const extraLength=align?(16384-(30+name.length)%16384)%16384:0;
  const local=Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);
  local.writeUInt32LE(data.length,18);local.writeUInt32LE(data.length,22);
  local.writeUInt16LE(name.length,26);local.writeUInt16LE(extraLength,28);
  const payload=Buffer.concat([local,name,Buffer.alloc(extraLength),data]);
  const central=Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);
  central.writeUInt32LE(data.length,20);central.writeUInt32LE(data.length,24);
  central.writeUInt16LE(name.length,28);
  const toc=Buffer.concat([central,name]);
  const eocd=Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50,0);eocd.writeUInt16LE(1,8);eocd.writeUInt16LE(1,10);
  eocd.writeUInt32LE(toc.length,12);eocd.writeUInt32LE(payload.length,16);
  return Buffer.concat([payload,toc,eocd]);
}
const native='lib/arm64-v8a/libdemo.so';
test('non-native APK has no embedded ELF and passes static inventory',()=>{
  const result=inspectApkBytes(zip('classes.dex',Buffer.from('DEX')));
  assert.equal(result.status,'PASS');assert.equal(result.libraries.length,0);
});
test('native APK with 16 KB ELF and ZIP alignment passes structural checks',()=>{
  const result=inspectApkBytes(zip(native,elf(),true));
  assert.equal(result.libraries.length,1);
  assert.equal(result.libraries[0].loadSegments,1);
});
test('native APK with 4 KB ELF alignment fails',()=>{
  assert.throws(()=>inspectApkBytes(zip(native,elf(4096),true)),/ELF PT_LOAD/);
});
test('uncompressed native APK with wrong ZIP offset fails',()=>{
  assert.throws(()=>inspectApkBytes(zip(native,elf(),false)),/not ZIP-aligned/);
});
test('corrupt ELF fails closed',()=>{
  assert.throws(()=>inspectApkBytes(zip(native,Buffer.alloc(120),true)),/Not an ELF/);
});
test('truncated or invalid APK fails closed',()=>{
  assert.throws(()=>inspectApkBytes(Buffer.alloc(22)),/central directory/);
  assert.throws(()=>inspectApkBytes(zip('classes.dex',Buffer.from('hi')).subarray(0,30)),/central directory/);
});
test('release evidence requires all four optimized APK results and fresh template fingerprint',()=>{
  const report={kind:'release-audit',schemaVersion:1,generatorFingerprint:'abc',results:PRESETS.map(preset=>({preset,status:'PASS',releaseApkBytes:1000,r8:{status:'PASS'},native:{status:'PASS'}}))};
  assert.deepEqual(checkReleaseApks(report,'abc').map(x=>x.status),['PASS','PASS']);
  assert.deepEqual(checkReleaseApks(report,'new').map(x=>x.status),['BLOCKED','BLOCKED']);
  report.results.pop();
  assert.deepEqual(checkReleaseApks(report,'abc').map(x=>x.status),['BLOCKED','BLOCKED']);
});
test('release evidence cannot ignore any explicit failure',()=>{
  const report={kind:'release-audit',schemaVersion:1,generatorFingerprint:'abc',results:PRESETS.map(preset=>({preset,status:'PASS',releaseApkBytes:1000,r8:{status:'PASS'},native:{status:'PASS'}}))};
  report.results[0].native.status='FAIL';
  assert.deepEqual(checkReleaseApks(report,'abc').map(x=>x.status),['PASS','FAIL']);
  report.kind='wrong';
  assert.deepEqual(checkReleaseApks(report,'abc').map(x=>x.status),['FAIL','FAIL']);
});
