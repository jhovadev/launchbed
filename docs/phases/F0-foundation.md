# F0 — Foundation and architecture

Date: 2026-11-13 · Branch: `main` (repository initialized, no commit created)

## Scope delivered

- Bun workspace monorepo with Astro 7 + SolidJS 1.9 web app.
- Strict contracts: `ProjectRequest`, `ThemeConfig`, `AddonManifest`,
  `GenerationPlan`, `CatalogResponse`.
- Shared engine: validate → resolve → plan → render → deterministic ZIP.
- API: `GET /api/catalog`, `POST /api/plan`, `POST /api/generate` (real ZIP).
- CLI with `catalog`, `validate`, `plan`, `generate`.
- Real `android-compose-minimal` template, embedded via drift-checked codegen.
- 18 declarative addon manifests (all `planned`), resolver with conflict/cycle/
  SDK tests.
- Material 3 tokens → Kotlin Compose codegen + token-based web preview.
- `mise.toml`, `justfile`, SDK/doctor/device/scrcpy scripts (bash + PowerShell).
- CI workflow, compose profile, MIT license, architecture/ADR/security docs.

## Not implemented (by design)

Authentication, Turso Sync, production Rust/Zig plugins, drag-and-drop editor,
full block catalog, web IDE, remote APK builds, in-browser emulator, addon
marketplace.

## Validation evidence

Environment: Linux x86_64, Bun 1.4.4, Node 24.22.2, Temurin 21.0.13+9.0.LTS,
Android platform 37.0, Build Tools 36.0.0/37.0.0.

| Check | Command | Result |
| --- | --- | --- |
| Install | `bun install` | PASS (253 packages) |
| Typecheck | `bun run typecheck` | PASS |
| Unit/security tests | `bun test packages tests` | PASS: 63 tests, 445 assertions |
| Template drift | `bun run templates:check` | PASS (37 embedded files) |
| Web build | `bun run build` | PASS (Astro server + client bundles) |
| Catalog API | `curl /api/catalog` | PASS, 200 |
| Plan API | `curl -X POST /api/plan` | PASS: 39 files / 104862 bytes |
| Generate API | `curl -X POST /api/generate` | PASS: 110086-byte ZIP |
| CLI parity | two `generate` runs + API ZIP | PASS: identical SHA-256 `d217765c…0888` |
| ZIP paths | `unzip -l` | PASS: 39 entries, fixed 1980-01-01 timestamps |
| ZIP permissions | extract | PASS: `gradlew` 0755, `scripts/*.sh` 0755, others 0644 |
| Gradle wrapper | inspect | PASS: 9.6.0 + SHA-256 pin |
| Android build | `./gradlew :app:assembleDebug :app:testDebugUnitTest` | PASS, APK 11,649,414 bytes |
| Unit tests | `:app:testDebugUnitTest` | PASS: 4 tests, 0 failures |
| Android Lint | `./gradlew :app:lintDebug` | PASS |
| Reproducible smoke | `bun scripts/android-smoke.ts` | PASS |
| `just` tasks | `just --list`, `doctor`, `sdk-setup` | PASS |
| SDK dry run | `bash scripts/sdk-setup.sh` | PASS, no files modified |

## Not executed / blocked

| Item | Status | Reason |
| --- | --- | --- |
| PowerShell syntax/runtime | NOT RUN | `pwsh` is not installed in this environment; scripts are shipped but unverified at runtime |
| Interactive multi-device prompt | NOT RUN | No authorized device/emulator attached; non-interactive behavior is tested |
| `install`/`launch`/`run`/`logs` against a device | NOT RUN | No device attached |
| Docker build | NOT RUN | Not required; `compose.yaml` is opt-in |
| SDK package installation | NOT RUN | All required packages were already installed; only the read-only plan path was exercised |
| Zig 0.17.1 build | NOT RUN | Contract only; local Zig is 0.16.0 and F0 ships no Zig code |
| Instrumented Android tests | NOT RUN | No device; F0 ships local unit tests only |

## Reproduction

```bash
mise install && bun install
just check
just android-smoke     # needs ANDROID_HOME with android-37.0
```

Artifacts from the recorded run are under `build/android-smoke/` (git-ignored).
