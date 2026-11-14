import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { BENCH_PRESETS, parseBenchmarkArgs, summarize } from './metrics.mjs';

test('generator selects all real presets with bounded sampling defaults', () => {
  const args = parseBenchmarkArgs(['generator']);
  assert.deepEqual(args.presets, BENCH_PRESETS);
  assert.equal(args.runs, 7);
  assert.equal(args.warmup, 2);
});
test('android defaults to one preset, with explicit all/release options', () => {
  assert.deepEqual(parseBenchmarkArgs(['android']).presets, ['compose-minimal']);
  assert.deepEqual(parseBenchmarkArgs(['android', '--all', '--release']).presets, BENCH_PRESETS);
});
test('explicit preset selects only a known name', () => {
  assert.deepEqual(parseBenchmarkArgs(['generator', '--preset', 'local-notes', '--runs', '3', '--warmup', '0']).presets, ['local-notes']);
  assert.throws(() => parseBenchmarkArgs(['generator', '--preset', '../bad']), /Unknown preset/);
});
test('refuses duplicate or ambiguous selections', () => {
  assert.throws(() => parseBenchmarkArgs(['android', '--all', '--preset', 'catalog-ui']), /either/);
  assert.throws(() => parseBenchmarkArgs(['generator', '--preset', 'local-notes', '--preset', 'local-notes']), /Duplicate/);
});
test('refuses unbounded benchmark counts and unknown flags', () => {
  for (const value of ['-1', '0', '2', '101', '3x', '9007199254740993']) {
    assert.throws(() => parseBenchmarkArgs(['generator', '--runs', value]));
  }
  assert.throws(() => parseBenchmarkArgs(['generator', '--warmup', '21']));
  assert.throws(() => parseBenchmarkArgs(['android', '--runs', '5']), /only apply/);
  assert.throws(() => parseBenchmarkArgs(['generator', '--release']), /only applies/);
  assert.throws(() => parseBenchmarkArgs(['generator', '--output', '/tmp/foo']), /Unknown option/);
});
test('reports a correct median and nearest-rank p95 without mutating input', () => {
  const raw = [6, 9, 1, 4];
  assert.deepEqual(summarize(raw), { count: 4, min: 1, median: 5, p95: 9, max: 9, mean: 5 });
  assert.deepEqual(raw, [6, 9, 1, 4]);
});
test('rejects empty, negative, NaN and infinite measurement samples', () => {
  for (const values of [[], [-1], [Number.NaN], [Infinity], [3, -0.1]]) {
    assert.throws(() => summarize(values));
  }
});
