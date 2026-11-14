import { InitializrError, validateRelativePath } from "@android-initializr/schema";

const LOCAL_HEADER = 0x04034b50;
const CENTRAL_HEADER = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY = 0x06054b50;

// 1980-01-01 00:00:00, the minimum DOS timestamp. Fixed for byte-identical ZIPs.
const DOS_DATE = 0x0021;
const DOS_TIME = 0x0000;
const UTF8_FLAG = 0x0800;
const VERSION_NEEDED = 20;
const VERSION_MADE_BY = (3 << 8) | VERSION_NEEDED; // Unix, ZIP 2.0

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    crc = CRC_TABLE[(crc ^ data[i]!) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export interface ZipInput {
  path: string;
  data: Uint8Array;
  executable?: boolean;
}

interface CentralRecord {
  pathBytes: Uint8Array;
  crc: number;
  size: number;
  offset: number;
  externalAttributes: number;
}

function writeUInt16(view: DataView, offset: number, value: number): void {
  view.setUint16(offset, value, true);
}

function writeUInt32(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value >>> 0, true);
}

/**
 * Deterministic, dependency-free ZIP writer using STORE (no compression).
 * - entries are sorted by path
 * - timestamps are fixed to 1980-01-01
 * - permissions are normalized to 0644 (0755 for explicitly executable files)
 * - duplicate paths are rejected
 */
export function createZip(entries: readonly ZipInput[]): Uint8Array {
  const sorted = [...entries].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const seen = new Set<string>();
  const chunks: Uint8Array[] = [];
  const central: CentralRecord[] = [];
  let offset = 0;

  for (const entry of sorted) {
    const problems = validateRelativePath(entry.path, "zip entry");
    if (problems.length > 0) {
      throw new InitializrError("ZIP_ERROR", problems.join("; "));
    }
    if (seen.has(entry.path)) {
      throw new InitializrError("ZIP_ERROR", `Duplicate ZIP entry: ${entry.path}`);
    }
    seen.add(entry.path);

    const pathBytes = new TextEncoder().encode(entry.path);
    const crc = crc32(entry.data);
    const mode = entry.executable ? 0o100755 : 0o100644;

    const localHeader = new Uint8Array(30 + pathBytes.length);
    const localView = new DataView(localHeader.buffer);
    writeUInt32(localView, 0, LOCAL_HEADER);
    writeUInt16(localView, 4, VERSION_NEEDED);
    writeUInt16(localView, 6, UTF8_FLAG);
    writeUInt16(localView, 8, 0); // STORE
    writeUInt16(localView, 10, DOS_TIME);
    writeUInt16(localView, 12, DOS_DATE);
    writeUInt32(localView, 14, crc);
    writeUInt32(localView, 18, entry.data.length);
    writeUInt32(localView, 22, entry.data.length);
    writeUInt16(localView, 26, pathBytes.length);
    writeUInt16(localView, 28, 0); // extra length
    localHeader.set(pathBytes, 30);

    chunks.push(localHeader, entry.data);
    central.push({
      pathBytes,
      crc,
      size: entry.data.length,
      offset,
      externalAttributes: mode * 0x10000,
    });
    offset += localHeader.length + entry.data.length;
  }

  const centralStart = offset;
  let centralSize = 0;
  for (const record of central) {
    const header = new Uint8Array(46 + record.pathBytes.length);
    const view = new DataView(header.buffer);
    writeUInt32(view, 0, CENTRAL_HEADER);
    writeUInt16(view, 4, VERSION_MADE_BY);
    writeUInt16(view, 6, VERSION_NEEDED);
    writeUInt16(view, 8, UTF8_FLAG);
    writeUInt16(view, 10, 0); // STORE
    writeUInt16(view, 12, DOS_TIME);
    writeUInt16(view, 14, DOS_DATE);
    writeUInt32(view, 16, record.crc);
    writeUInt32(view, 20, record.size);
    writeUInt32(view, 24, record.size);
    writeUInt16(view, 28, record.pathBytes.length);
    writeUInt16(view, 30, 0); // extra
    writeUInt16(view, 32, 0); // comment
    writeUInt16(view, 34, 0); // disk start
    writeUInt16(view, 36, 0); // internal attributes
    writeUInt32(view, 38, record.externalAttributes);
    writeUInt32(view, 42, record.offset);
    header.set(record.pathBytes, 46);
    chunks.push(header);
    centralSize += header.length;
  }

  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  writeUInt32(endView, 0, END_OF_CENTRAL_DIRECTORY);
  writeUInt16(endView, 4, 0);
  writeUInt16(endView, 6, 0);
  writeUInt16(endView, 8, central.length);
  writeUInt16(endView, 10, central.length);
  writeUInt32(endView, 12, centralSize);
  writeUInt32(endView, 16, centralStart);
  writeUInt16(endView, 20, 0);
  chunks.push(end);

  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(total);
  let cursor = 0;
  for (const chunk of chunks) {
    output.set(chunk, cursor);
    cursor += chunk.length;
  }
  return output;
}

export interface ZipEntry {
  path: string;
  size: number;
  crc: number;
  method: number;
  flags: number;
  externalAttributes: number;
  data: Uint8Array;
  executable: boolean;
}

function fail(message: string): never {
  throw new InitializrError("ZIP_ERROR", message);
}

/**
 * Strict reader used by tests and by the generator's self-check.
 * Rejects traversal, duplicates, encryption, data descriptors and unknown methods.
 */
export function readZip(buffer: Uint8Array): ZipEntry[] {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const minOffset = Math.max(0, buffer.length - 22 - 0xffff);
  let eocd = -1;
  for (let i = buffer.length - 22; i >= minOffset; i -= 1) {
    if (view.getUint32(i, true) === END_OF_CENTRAL_DIRECTORY) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) fail("ZIP end-of-central-directory record not found.");

  const count = view.getUint16(eocd + 10, true);
  const centralSize = view.getUint32(eocd + 12, true);
  const centralOffset = view.getUint32(eocd + 16, true);
  if (count === 0xffff || centralOffset === 0xffffffff) fail("ZIP64 archives are not supported.");
  if (centralOffset + centralSize > buffer.length) fail("ZIP central directory is out of bounds.");

  const entries: ZipEntry[] = [];
  const seen = new Set<string>();
  let cursor = centralOffset;

  for (let index = 0; index < count; index += 1) {
    if (cursor + 46 > buffer.length || view.getUint32(cursor, true) !== CENTRAL_HEADER) {
      fail("Invalid ZIP central directory entry.");
    }
    const flags = view.getUint16(cursor + 8, true);
    const method = view.getUint16(cursor + 10, true);
    const crc = view.getUint32(cursor + 16, true);
    const size = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const externalAttributes = view.getUint32(cursor + 38, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const nameStart = cursor + 46;
    const nameEnd = nameStart + nameLength;
    if (nameEnd > buffer.length) fail("ZIP entry name is out of bounds.");

    const path = new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(nameStart, nameEnd));
    const problems = validateRelativePath(path, "zip entry");
    if (problems.length > 0) fail(problems.join("; "));
    if (seen.has(path)) fail(`Duplicate ZIP entry: ${path}`);
    seen.add(path);

    if ((flags & 0x0001) !== 0) fail(`Encrypted ZIP entry is not allowed: ${path}`);
    if ((flags & 0x0008) !== 0) fail(`ZIP data descriptors are not allowed: ${path}`);
    if (method !== 0) fail(`Unsupported ZIP compression method ${method} for ${path}`);

    if (localOffset + 30 > buffer.length || view.getUint32(localOffset, true) !== LOCAL_HEADER) {
      fail(`Invalid local header for ${path}`);
    }
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + size;
    if (dataEnd > buffer.length) fail(`ZIP entry data is out of bounds: ${path}`);

    const data = buffer.subarray(dataStart, dataEnd);
    if (crc32(data) !== crc) fail(`CRC mismatch for ${path}`);

    entries.push({
      path,
      size,
      crc,
      method,
      flags,
      externalAttributes,
      data,
      executable: (externalAttributes >>> 16) === 0o100755,
    });
    cursor = nameEnd + extraLength + commentLength;
  }

  return entries;
}
