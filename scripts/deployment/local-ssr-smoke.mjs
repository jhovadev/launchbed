#!/usr/bin/env node
/** Run the real Astro standalone SSR server and exercise its HTML + ZIP API endpoints.
 * Run only after `bun run build` (Node adapter). No Vercel credentials required.
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSmoke } from './vercel-smoke.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const entry = join(root, 'apps/web/dist/server/entry.mjs');

async function allocatePort() {
  return new Promise((resolvePort, rejectPort) => {
    const server = createServer();
    server.once('error', rejectPort);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = address && typeof address !== 'string' ? address.port : null;
      server.close((error) => error ? rejectPort(error) : resolvePort(port));
    });
  });
}

async function waitForServer(base, child, getLog, timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`Astro SSR server exited early: ${getLog()}`);
    }
    try {
      // Probe a simple API route first; GET / is checked by the full smoke below.
      const response = await fetch(`${base}/api/catalog`, { signal: AbortSignal.timeout(1000) });
      await response.body?.cancel();
      if (response.ok) return;
    } catch {
      await new Promise((r) => setTimeout(r, 150));
    }
  }
  throw new Error(`Astro SSR startup timed out: ${getLog()}`);
}

if (!existsSync(entry)) {
  console.error('FAIL local SSR smoke: missing Node adapter build; run `bun run build` first.');
  process.exitCode = 1;
} else {
  const port = await allocatePort();
  const base = `http://127.0.0.1:${port}`;
  let output = '';
  const child = spawn(process.execPath, [entry], {
    cwd: root,
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const addOutput = (chunk) => { output = (output + String(chunk)).slice(-12000); };
  child.stdout.on('data', addOutput);
  child.stderr.on('data', addOutput);
  try {
    await waitForServer(base, child, () => output);
    const result = await runSmoke(base);
    console.log(`PASS Kotlaunch local SSR and ZIP smoke: ${JSON.stringify(result)}`);
  } catch (error) {
    console.error(`FAIL local SSR smoke: ${error instanceof Error ? error.message : String(error)}`);
    if (output.trim()) console.error(output);
    process.exitCode = 1;
  } finally {
    if (child.exitCode === null) child.kill('SIGTERM');
    await new Promise((resolveDone) => {
      if (child.exitCode !== null || child.signalCode !== null) return resolveDone();
      child.once('exit', resolveDone);
      setTimeout(() => { if (child.exitCode === null) child.kill('SIGKILL'); resolveDone(); }, 3000).unref();
    });
  }
}
