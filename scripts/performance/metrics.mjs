/** Pure F1.6B benchmark helpers; no SDK, clock or filesystem access. */
export const BENCH_PRESETS = Object.freeze(['compose-minimal', 'compose-starter', 'local-notes', 'catalog-ui']);

function integerFlag(name, value, minimum, maximum) {
  if (value === undefined || !/^(0|[1-9][0-9]*)$/.test(value)) {
    throw new Error(`${name} requires an integer from ${minimum} to ${maximum}`);
  }
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < minimum || count > maximum) {
    throw new Error(`${name} must be between ${minimum} and ${maximum}`);
  }
  return count;
}

export function parseBenchmarkArgs(argv) {
  const [command, ...args] = argv;
  if (command !== 'generator' && command !== 'android') {
    throw new Error('Usage: benchmark generator|android [--all | --preset ID] [--runs N] [--warmup N] [--release]');
  }
  let preset;
  let all = false;
  let runs = 7;
  let warmup = 2;
  let release = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--all') { if (all) throw new Error('Duplicate --all'); all = true; continue; }
    if (arg === '--release') { if (release) throw new Error('Duplicate --release'); release = true; continue; }
    if (arg === '--preset') {
      if (preset !== undefined) throw new Error('Duplicate --preset');
      preset = args[++i];
      if (!BENCH_PRESETS.includes(preset)) throw new Error(`Unknown preset: ${preset ?? '(missing)'}`);
      continue;
    }
    if (arg === '--runs') { runs = integerFlag(arg, args[++i], 3, 100); continue; }
    if (arg === '--warmup') { warmup = integerFlag(arg, args[++i], 0, 20); continue; }
    throw new Error(`Unknown option: ${arg}`);
  }
  if (all && preset) throw new Error('Choose either --preset or --all');
  if (command === 'android' && (args.includes('--runs') || args.includes('--warmup'))) {
    throw new Error('--runs and --warmup only apply to generator benchmarks');
  }
  if (command === 'generator' && release) throw new Error('--release only applies to Android builds');
  const presets = preset ? [preset] : (command === 'generator' || all ? [...BENCH_PRESETS] : ['compose-minimal']);
  return { command, presets, runs, warmup, release };
}

function rounded(value) { return Math.round(value * 1000) / 1000; }

/** Nearest-rank p95; samples are not asserted as performance thresholds. */
export function summarize(samples) {
  if (!Array.isArray(samples) || samples.length === 0 || samples.some((v) => !Number.isFinite(v) || v < 0)) {
    throw new Error('Expected nonempty finite nonnegative samples');
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const count = sorted.length;
  const middle = Math.floor(count / 2);
  const p50 = count % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  return {
    count,
    min: rounded(sorted[0]),
    median: rounded(p50),
    p95: rounded(sorted[Math.ceil(0.95 * count) - 1]),
    max: rounded(sorted[count - 1]),
    mean: rounded(samples.reduce((total, value) => total + value, 0) / count),
  };
}
