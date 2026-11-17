import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeBaseUrl, parseArgs, runSmoke } from './vercel-smoke.mjs';

test('rejects unsafe URLs and accepts HTTPS or localhost HTTP', () => {
  assert.equal(normalizeBaseUrl('https://launchbed.vercel.app/'), 'https://launchbed.vercel.app');
  assert.equal(normalizeBaseUrl('http://127.0.0.1:4321/'), 'http://127.0.0.1:4321');
  for (const bad of ['http://launchbed.vercel.app/', 'javascript:alert(1)', 'https://test:token@example.com/', 'https://example.com/path', 'https://example.com/?x=1']) {
    assert.throws(() => normalizeBaseUrl(bad));
  }
});

test('validates timeout and arguments strictly', () => {
  assert.deepEqual(parseArgs(['--url', 'https://launchbed.vercel.app', '--timeout-ms', '1000']), { baseUrl: 'https://launchbed.vercel.app', timeoutMs: 1000 });
  for (const argv of [['--unknown'], ['--url'], ['--url', 'https://test.com', '--timeout-ms', '0'], ['--url', 'https://test.com', '--timeout-ms', 'Infinity']]) {
    assert.throws(() => parseArgs(argv));
  }
});

function mockResponses({ corruptZip = false, mismatchHash = false, oldBuilder = false, noDelegate = false } = {}) {
  const reqHash = 'example-deterministic-hash';
  const zip = Buffer.from('504b03046162636465666768696a6b6c6d6e6f707172737475767778797a', 'hex');
  const fakeFetch = async (url, init = {}) => {
    const path = new URL(url).pathname;
    const delegate = typeof init.body === 'string' && init.body.includes('"target":"expo"');
    if (path === '/') return new Response(`<title>Launchbed</title><div id="configurator" ${oldBuilder ? '' : 'data-launchbed-ui="v1"'}><form><input id="projectName" name="projectName" /></form></div>`, { headers: { 'content-type': 'text/html' } });
    if (path === '/components') return new Response('<div data-launchbed-components="v1"></div>', { headers: { 'content-type': 'text/html' } });
    if (path === '/api/components') return Response.json({ components: [{}, {}, {}, {}, {}, {}] });
    if (path === '/api/catalog') return Response.json({ addons: [] });
    if (path === '/api/presets') return Response.json({ presets: [{}, {}, {}, {}] });
    if (path === '/api/plan') return Response.json({ totals: { files: delegate ? 2 : 3 }, request: { hash: reqHash } });
    if (path === '/api/generate') {
      return new Response(corruptZip ? Buffer.from('bad zip of adequate length for test data') : zip, {
        headers: {
          'content-type': 'application/zip',
          'x-generation-hash': mismatchHash ? 'not-matching' : reqHash,
          'x-generation-files': delegate ? '2' : '3',
          ...(delegate && !noDelegate ? { 'x-generation-strategy': 'delegate', 'x-delegate-command': 'npx --yes create-expo-app@5.0.0 demo' } : {}),
        },
      });
    }
    throw new Error(`Unexpected path ${path}`);
  };
  return fakeFetch;
}

test('verifies homepage, API contracts and repeat ZIP determinism', async () => {
  const result = await runSmoke('https://launchbed.vercel.app', mockResponses());
  assert.equal(result.presets, 4);
  assert.equal(result.components, 6);
  assert.equal(result.files, 3);
  assert.ok(result.zipSha256.length === 64);
  assert.equal(result.overlayFiles, 2);
});

test('requires an overlay ZIP with the official command for delegated targets', async () => {
  await assert.rejects(runSmoke('https://launchbed.vercel.app', mockResponses({ noDelegate: true })), /delegate strategy/);
});

test('rejects invalid ZIP and mismatched request hash', async () => {
  await assert.rejects(runSmoke('https://launchbed.vercel.app', mockResponses({ corruptZip: true })), /invalid ZIP/);
  await assert.rejects(runSmoke('https://launchbed.vercel.app', mockResponses({ mismatchHash: true })), /request hash/);
});

test('does not accept a shell-only SSR response with missing Solid form', async () => {
  const onlyShell = async (url, init) => {
    if (new URL(url).pathname === '/') {
      return new Response('<section id="configurator">Loading</section>', { headers: { 'content-type': 'text/html' } });
    }
    return mockResponses()(url, init);
  };
  await assert.rejects(runSmoke('https://launchbed.vercel.app', onlyShell), /Solid configurator form missing/);
});

test('rejects an older builder despite HTTP 200 and a complete form', async () => {
  await assert.rejects(runSmoke('https://launchbed.vercel.app', mockResponses({ oldBuilder: true })), /outdated project builder/);
});

test('identifies unrelated HTML rather than reporting a generic SSR failure', async () => {
  const unrelated = async (url, init) => {
    if (new URL(url).pathname === '/') return new Response('<title>Other site</title><main>Hello</main>', { headers: { 'content-type': 'text/html' } });
    return mockResponses()(url, init);
  };
  await assert.rejects(runSmoke('https://launchbed.vercel.app', unrelated), /page title: Other site/);
});
