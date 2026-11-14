#!/usr/bin/env node
/** Fails closed on missing/unsynchronized Vercel adapter and workspace config. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
try {
  const web = JSON.parse(readFileSync(join(root, 'apps/web/package.json'), 'utf8'));
  const lock = readFileSync(join(root, 'bun.lock'), 'utf8');
  const adapter = web.dependencies?.['@astrojs/vercel'];
  const config = readFileSync(join(root, 'apps/web/astro.config.mjs'), 'utf8');
  if (adapter !== '11.0.22') throw new Error('Expected pinned @astrojs/vercel@11.0.22 in apps/web/package.json');
  // Bun text lockfile uses JSONC-like trailing commas, so inspect its explicit workspace entry.
  if (!lock.includes(`"@astrojs/vercel": "${adapter}"`) || !lock.includes(`"@astrojs/vercel": ["@astrojs/vercel@${adapter}"`)) {
    throw new Error('bun.lock lacks the pinned adapter; run `bun install` at repository root and commit bun.lock.');
  }
  if (!config.includes('vercel()') || !config.includes('deployToVercel')) throw new Error('Missing dual-target Astro adapter configuration');
  console.log(`PASS Vercel dependency and lockfile preflight (@astrojs/vercel@${adapter})`);
} catch (error) {
  console.error(`FAIL Vercel preflight: ${error.message}`);
  process.exitCode = 1;
}
