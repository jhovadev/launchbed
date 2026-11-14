# Roadmap

F0 is intentionally small. Each later phase is a reviewable patch series.

## F1 — Template depth and first stable addons

- Room addon (`storage/room`) with KSP, entities, DAO, repository, tests.
- UI addons: navigation, settings, dashboard.
- Addon file-operation `modify` support with structured, tested patches.
- Golden-file tests for every addon combination.
- Acceptance: generated Room project builds and unit tests pass; addons are
  `stable` and `generatable`; resolver tests cover each combination.

## F2 — CLI and SDK ergonomics

- Official Android CLI integration (`android sdk`, `android create`) where it
  reduces custom scripting.
- `android-initializr doctor` and project upgrade command.
- Multi-module template (app + core + feature modules).
- Acceptance: documented CLI parity; no Android Studio assumptions.

## F3 — Design system depth

- Typography scale tokens, dynamic color option, component token catalog.
- Accessibility checks in the preview; visual regression snapshots.
- Acceptance: generated theme snapshot tests; documented differences from
  Compose rendering.

## F4 — Native addons (Rust/Zig)

- Rust `cdylib` addon with cargo-ndk, JNI wrapper, ownership tests.
- Zig 0.17.1 addon with C ABI and 16 KB alignment verification.
- `zipalign -P 16` and ELF alignment checks in CI.
- Acceptance: arm64-v8a and x86_64 build; instrumentation-free JVM tests; no
  native code in the minimal template.

## F5 — Persistence and sync

- libSQL/Turso addons with local file and explicit remote replica configuration.
- Runtime-supplied credentials only; no tokens in APKs.
- Opt-in compose profile for `sqld`.
- Acceptance: offline-first demo, documented threat model, no cloud provider
  required for the base project.

## Explicitly deferred

Accounts, marketplace, remote builds, browser emulator, drag-and-drop editor.

## F1.6C — Integrity / release evidence

Source-only generator checks, patch chain replay and classification of runtime/benchmark evidence. Release readiness remains BLOCKED without instrumented tests and native/release audits. No new addons or i18n.

## F1.6D — Optimized release and local-first backup policy

Enables AGP 9.5 release `optimization { enable = true }`, explicit default backup exclusions for privacy, and opt-in unsigned release APK audits. Release checks remain blocked without actual optimized APK evidence and device instrumentation. A default backup exclusion can sacrifice restoration of user-created local data; publish only after reviewing that trade-off.
