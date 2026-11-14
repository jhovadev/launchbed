# Performance measurement policy (F1.6B)

This document describes **how to measure**, not a claim that a performance improvement occurred. The F1.6A.1 reported baseline is 104 Bun tests / 607 assertions, and the 4 generated presets compiled, but **device instrumented tests were NOT RUN**. This patch adds repeatable measurements without changing any generated Android application.

## Commands

```bash
# No Android SDK required; 7 measured runs and 2 warmups by default.
just benchmark-generator
bun run scripts/performance-baseline.ts generator --preset local-notes --runs 11 --warmup 3

# SDK + Java 21 + Gradle deps required; first build and no-change repeat.
just benchmark-android
bun run scripts/performance-baseline.ts android --all
bun run scripts/performance-baseline.ts android --preset catalog-ui --release

# Pure CLI and statistics tests; does not require Bun.
just benchmark-parser-test
```

Outputs are ignored by Git: `build/performance/generator.json` and `build/performance/android.json`; extracted Android projects remain under `build/performance/android/<preset>/`. No phone, emulator, SDK packages, signing keys, external cloud service, or remote performance service is used by these commands. Gradle may download pinned dependencies if they are not yet present in the local cache.

## What is actually measured

| Metric | Definition | Caveat |
| --- | --- | --- |
| `materializeMs` | Parsed request → resolved addons → template rendering → plan and file hashes | Cannot be attributed to individual validate/resolve/plan steps without separate instrumentation |
| `packageMs` | ZIP creation from already materialized files | Does not include file extraction or HTTP transfer |
| `verifyMs` | Re-read ZIP and verify every planned SHA-256 / path / mode | Reproducibility check on every sampled run |
| `totalMs` | Combined materialize + package + verify | Excludes the cross-check against the production `generateProject()` pipeline |
| `heapAfterBytes` and `rssAfterBytes` | Process memory snapshots after each operation | NOT peak memory, per-operation allocations or GC-adjusted measurements |
| `firstBuild` | First Gradle build of a freshly extracted generated project | Shared Gradle/Maven caches may already be warm; not a cold machine build |
| `noChangeRepeat` | Repeat with no modified source files | NOT an incremental rebuild after a source edit |
| `debugApkBytes` | Size of actual `app-debug.apk` | Not download size from Play Store and not release APK size |
| `unsignedReleaseApkBytes` | Size of unsigned `app-release-unsigned.apk`, if `--release` used | No installability or performance claim |

Generator sampling uses a monotonic clock, fixed warmup and run counts, sorted output and byte-level SHA-256 equality with the production generator for **every** iteration. JSON summaries use min, median, mean, max, and nearest-rank p95. Runs are bounded to 3–100; warmups to 0–20. A benchmark failing a hash or ZIP verification exits nonzero.

The generator JSON includes the runtime platform and arch. Do not compare absolute execution times across different computers, SDK installations, Gradle caches, JDKs, runtime versions, or CPU/power conditions. Do not use timing thresholds as mandatory CI gates. The chosen values are a baseline for later local comparisons, not an SLO.

The Gradle benchmark runs sequentially on an explicit whitelist of four presets. The default is **only compose-minimal** to avoid unexpectedly building all presets. `--all` opts in to all four. Only the fixed output directories under `build/performance/android/` are deleted. The operation produces separate reports for PASS / FAIL / BLOCKED, with Gradle errors retained in the JSON report. Existing outputs of F1.6A in `build/runtime-verification/` are not touched.

## Interpreting performance

1. Run both before and after measurements on the same machine with the same versions and cache conditions.
2. Preserve both JSON outputs outside `build/` before making a change; both are intentionally ignored by Git.
3. Re-run the normal correctness gates (`just check`, `just android-runtime-compile`) before accepting a performance change.
4. Use Android Macrobenchmark `StartupTimingMetric`, frame-timing metrics, Perfetto traces and Baseline Profiles **only when tests can actually run on a suitable device**. No startup/FPS metrics or Baseline Profile assets are generated in F1.6B.
5. Keep `compose-minimal` independent of optional Room/Navigation/Foundation dependencies and benchmarking artifacts.

## Deferred work

F1.6C will cover release/integrity gates, dependency audit and patch-chain reproducibility. True release runtime performance, device memory, startup, frame timing and Baseline Profile generation require an explicit instrumented environment and should be tracked separately; compilation or benchmark scaffolding is not evidence of those metrics.
