#!/usr/bin/env node
/** Public HTTP contract smoke for a deployed Launchbed. No SDK needed. */
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export function normalizeBaseUrl(raw) {
  if (!raw || typeof raw !== 'string') throw new Error('Pass --url https://your-app.vercel.app');
  const url = new URL(raw);
  const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (!((url.protocol === 'https:') || (url.protocol === 'http:' && isLocal))) {
    throw new Error('Deployment URL must use HTTPS (HTTP allowed for localhost only).');
  }
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Use a deployment origin without credentials, query, fragment or path.');
  }
  return url.origin;
}

export function parseArgs(argv) {
  let url; let timeoutMs = 20000;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--url' && argv[i + 1]) { url = argv[++i]; continue; }
    if (arg === '--timeout-ms' && argv[i + 1]) {
      timeoutMs = Number(argv[++i]);
      if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 120000) {
        throw new Error('--timeout-ms must be an integer between 1000 and 120000.');
      }
      continue;
    }
    throw new Error(`Unknown or incomplete argument: ${arg}`);
  }
  return { baseUrl: normalizeBaseUrl(url ?? process.env.LAUNCHBED_DEPLOY_URL), timeoutMs };
}

const defaultRequest = {
  template: 'android-compose-minimal',
  projectName: 'Launchbed Deploy Smoke',
  applicationId: 'dev.launchbed.smoke',
  namespace: 'dev.launchbed.smoke',
  minSdk: 26,
  compileSdk: 37,
  targetSdk: 36,
  addons: [],
};

export async function runSmoke(baseUrl, fetchFn = fetch, { timeoutMs = 20000 } = {}) {
  const base = normalizeBaseUrl(baseUrl);
  const makeRequest = async (path, init = {}) => {
    const url = base + path;
    const response = await fetchFn(url, {
      ...init,
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (response.status !== 200) throw new Error(`${path}: expected 200; got HTTP ${response.status}`);
    return response;
  };
  const home = await makeRequest('/');
  if (!(home.headers.get('content-type') || '').includes('text/html')) throw new Error('/: expected HTML');
  const html = await home.text();
  // A 200 HTML response may still be a stale deployment, a protection page, or an SSR error.
  // Show a short, safe title to make the correct deployment straightforward to identify.
  const pageTitle = (/<title[^>]*>([^<]{0,100})<\/title>/i.exec(html)?.[1] || '(no HTML title)').trim();
  const diagnose = (issue) => new Error(`/: ${issue}; page title: ${pageTitle}; requested origin: ${base}. Check the Ready production deployment in Vercel.`);
  if (!html.includes('id="configurator"')) throw diagnose('configurator section missing');
  // client:load still server-renders SolidJS. An incomplete SSR stream can be HTTP 200;
  // a section wrapper alone is not proof the Configurator component rendered.
  if (!/<form\b/.test(html) || !html.includes('id="projectName"')) {
    throw diagnose('Solid configurator form missing (check SSR function logs)');
  }

  if (!html.includes('data-launchbed-ui="v1"')) {
    throw diagnose('outdated project builder; the Launchbed wizard has not reached this deployment');
  }

  const catalog = await (await makeRequest('/api/catalog')).json();
  if (!catalog || typeof catalog !== 'object' || 'error' in catalog) throw new Error('/api/catalog: invalid payload');
  const presets = await (await makeRequest('/api/presets')).json();
  if (!Array.isArray(presets?.presets) || presets.presets.length < 4) {
    throw new Error('/api/presets: expected a list of at least four presets');
  }
  const body = JSON.stringify(defaultRequest);
  const headers = { 'content-type': 'application/json' };
  const plan = await (await makeRequest('/api/plan', { method: 'POST', headers, body })).json();
  if (!Number.isInteger(plan?.totals?.files) || plan.totals.files < 1 || !plan?.request?.hash) {
    throw new Error('/api/plan: missing file totals or request hash');
  }
  const hashes = [];
  let size = 0;
  for (let n = 0; n < 2; n++) {
    const response = await makeRequest('/api/generate', { method: 'POST', headers, body });
    if (!response.headers.get('content-type')?.includes('application/zip')) {
      throw new Error('/api/generate: expected application/zip');
    }
    if (response.headers.get('x-generation-hash') !== plan.request.hash) {
      throw new Error('/api/generate: request hash disagrees with /api/plan');
    }
    if (Number(response.headers.get('x-generation-files')) !== plan.totals.files) {
      throw new Error('/api/generate: file count disagrees with /api/plan');
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 30 || bytes.length > 8 * 1024 * 1024 || bytes.toString('hex', 0, 4) !== '504b0304') {
      throw new Error('/api/generate: invalid ZIP header or size');
    }
    size = bytes.length;
    hashes.push(createHash('sha256').update(bytes).digest('hex'));
  }
  if (hashes[0] !== hashes[1]) throw new Error('/api/generate: repeated ZIP bytes are not deterministic');
  return { baseUrl: base, presets: presets.presets.length, files: plan.totals.files, zipBytes: size, zipSha256: hashes[0] };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const { baseUrl, timeoutMs } = parseArgs(process.argv.slice(2));
    const output = await runSmoke(baseUrl, fetch, { timeoutMs });
    process.stdout.write(`PASS Launchbed Vercel smoke: ${JSON.stringify(output)}\n`);
  } catch (error) {
    console.error(`FAIL Launchbed Vercel smoke: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
