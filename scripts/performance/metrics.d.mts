export declare const BENCH_PRESETS: readonly ('compose-minimal' | 'compose-starter' | 'local-notes' | 'catalog-ui')[];
export interface BenchmarkOptions {
  command: 'generator' | 'android';
  presets: string[];
  runs: number;
  warmup: number;
  release: boolean;
}
export declare function parseBenchmarkArgs(argv: string[]): BenchmarkOptions;
export interface SampleSummary { count: number; min: number; median: number; p95: number; max: number; mean: number }
export declare function summarize(samples: number[]): SampleSummary;
