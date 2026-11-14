/** Deterministic hash of the source material that produces/executes Android tests. */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, lstatSync } from 'node:fs';
import { join, relative } from 'node:path';

const SOURCE_PATHS = Object.freeze([
  'packages/schema/src', 'packages/catalog/src', 'packages/resolver/src',
  'packages/generator/src', 'packages/design-tokens/src',
  'addons', 'presets', 'templates', 'examples/basic.json',
  'scripts/android-runtime.ts', 'scripts/runtime',
]);

export function runtimeSourceFingerprint(root) {
  const hash = createHash('sha256');
  let files = 0;
  function visit(path) {
    const info = lstatSync(path);
    if (info.isSymbolicLink()) throw new Error('Runtime fingerprint refuses symlinks');
    if (info.isDirectory()) {
      for (const name of readdirSync(path).sort()) visit(join(path, name));
    } else if (info.isFile()) {
      const rel = relative(root, path).replaceAll('\\', '/');
      hash.update(rel, 'utf8'); hash.update('\0');
      hash.update(readFileSync(path)); hash.update('\0');
      files++;
    } else throw new Error('Unexpected source type in runtime fingerprint');
  }
  for (const item of SOURCE_PATHS) visit(join(root, item));
  if (!files) throw new Error('Runtime fingerprint contains no source files');
  return hash.digest('hex');
}
