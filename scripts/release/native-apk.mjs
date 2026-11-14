/** Inspect native binaries in an actual APK. Static checks only; no device/runtime claims. */
import {readFileSync} from 'node:fs';
import {inflateRawSync} from 'node:zlib';

const PAGE = 16384;
const MAX_SO = 64 * 1024 * 1024;
function requireRange(buffer, offset, size, name) {
  if (!Number.isSafeInteger(offset) || offset < 0 || offset + size > buffer.length) throw new Error(`Invalid ${name} range`);
}
function zipEntries(buffer) {
  const start=Math.max(0,buffer.length-65557);
  let eocd=-1;
  for (let i=buffer.length-22;i>=start;i--) if(buffer.readUInt32LE(i)===0x06054b50 && i+22+buffer.readUInt16LE(i+20)===buffer.length){eocd=i;break;}
  if(eocd<0) throw new Error('APK central directory missing or trailing data');
  if(buffer.readUInt16LE(eocd+4)!==0 || buffer.readUInt16LE(eocd+6)!==0) throw new Error('Multi-disk ZIP unsupported');
  const count=buffer.readUInt16LE(eocd+10);
  const size=buffer.readUInt32LE(eocd+12);
  const centralStart=buffer.readUInt32LE(eocd+16);
  if(count===65535 || size===0xffffffff || centralStart===0xffffffff) throw new Error('ZIP64 APK unsupported by static inspector');
  requireRange(buffer,centralStart,size,'central directory');
  const list=[];const seen=new Set(); let offset=centralStart;
  for(let i=0;i<count;i++){
    requireRange(buffer,offset,46,'central entry');
    if(buffer.readUInt32LE(offset)!==0x02014b50) throw new Error('Invalid ZIP central header');
    const flags=buffer.readUInt16LE(offset+8),method=buffer.readUInt16LE(offset+10);
    const compressed=buffer.readUInt32LE(offset+20),uncompressed=buffer.readUInt32LE(offset+24);
    const n=buffer.readUInt16LE(offset+28),extra=buffer.readUInt16LE(offset+30),comment=buffer.readUInt16LE(offset+32);
    const localOffset=buffer.readUInt32LE(offset+42);
    requireRange(buffer,offset+46,n+extra+comment,'central filename');
    const name=buffer.subarray(offset+46,offset+46+n).toString('utf8');
    if(seen.has(name)) throw new Error(`Duplicate APK entry ${name}`);
    seen.add(name);
    if(flags & 1) throw new Error('Encrypted APK entry unsupported');
    if(localOffset===0xffffffff || compressed===0xffffffff || uncompressed===0xffffffff) throw new Error('ZIP64 entry unsupported');
    requireRange(buffer,localOffset,30,'local entry');
    if(buffer.readUInt32LE(localOffset)!==0x04034b50) throw new Error(`Invalid local ZIP header: ${name}`);
    const ln=buffer.readUInt16LE(localOffset+26),le=buffer.readUInt16LE(localOffset+28);
    const dataOffset=localOffset+30+ln+le;
    requireRange(buffer,dataOffset,compressed,'ZIP contents');
    if(buffer.subarray(localOffset+30,localOffset+30+ln).toString('utf8')!==name) throw new Error(`Local/central ZIP filename mismatch: ${name}`);
    list.push({name,flags,method,compressed,uncompressed,dataOffset});
    offset+=46+n+extra+comment;
  }
  if(offset!==centralStart+size) throw new Error('Inconsistent ZIP central directory size');
  return list;
}
function elfAlignment(bytes) {
  if(bytes.length<64 || bytes.toString('latin1',0,4)!=='\x7fELF') throw new Error('Not an ELF library');
  const cls=bytes[4],endian=bytes[5];
  if(![1,2].includes(cls) || ![1,2].includes(endian)) throw new Error('Unsupported ELF format');
  const le=endian===1;
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const u16=(o)=>{requireRange(bytes,o,2,'ELF');return view.getUint16(o,le);};
  const u32=(o)=>{requireRange(bytes,o,4,'ELF');return view.getUint32(o,le);};
  const u64=(o)=>{requireRange(bytes,o,8,'ELF');const value=Number(view.getBigUint64(o,le));if(!Number.isSafeInteger(value))throw new Error('Unsupported huge ELF offset');return value;};
  const offset=cls===2?u64(32):u32(28),entrySize=cls===2?u16(54):u16(42),count=cls===2?u16(56):u16(44);
  if(count<1 || count>1024 || entrySize<(cls===2?56:32)) throw new Error('Invalid ELF program headers');
  let loads=0;
  for(let i=0;i<count;i++) {
    const ph=offset+i*entrySize;
    requireRange(bytes,ph,cls===2?56:32,'program header');
    if(u32(ph)!==1) continue; // PT_LOAD
    const pOffset=cls===2?u64(ph+8):u32(ph+4);
    const vaddr=cls===2?u64(ph+16):u32(ph+8);
    const align=cls===2?u64(ph+48):u32(ph+28);
    loads++;
    if(align<PAGE || pOffset%PAGE!==vaddr%PAGE) throw new Error(`ELF PT_LOAD not aligned for 16 KB (p_align=${align})`);
  }
  if(!loads) throw new Error('ELF lacks PT_LOAD segments');
  return loads;
}
export function inspectApkBytes(input) {
  const bytes=Buffer.from(input);
  const entries=zipEntries(bytes);
  const libraries=[];
  for(const entry of entries) {
    if(!entry.name.endsWith('.so')) continue;
    if(!/^lib\/(arm64-v8a|x86_64|armeabi-v7a|x86)\/[^/]+\.so$/.test(entry.name)) throw new Error(`Unexpected native library path: ${entry.name}`);
    if(![0,8].includes(entry.method) || entry.uncompressed>MAX_SO) throw new Error(`Unsupported native ZIP method/size: ${entry.name}`);
    const compressed=bytes.subarray(entry.dataOffset,entry.dataOffset+entry.compressed);
    const elf=entry.method===8?inflateRawSync(compressed,{maxOutputLength:MAX_SO}):compressed;
    if(elf.length!==entry.uncompressed) throw new Error(`Native uncompressed size mismatch: ${entry.name}`);
    const loadSegments=elfAlignment(elf);
    if(entry.method===0 && entry.dataOffset%PAGE!==0) throw new Error(`Uncompressed .so is not ZIP-aligned to 16 KB: ${entry.name}`);
    libraries.push({path:entry.name,abi:entry.name.split('/')[1],compressed:entry.method===8,loadSegments});
  }
  return {status:'PASS',libraries,detail:libraries.length?`${libraries.length} native libraries pass static ZIP/ELF alignment checks`:'No bundled native .so libraries in this APK'};
}
export function inspectApk(path) { return inspectApkBytes(readFileSync(path)); }
