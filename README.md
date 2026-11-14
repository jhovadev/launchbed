# Kotlaunch — Native Android Initializr

Generate **native Android** projects — Kotlin + Jetpack Compose Material 3 — from the
web, an HTTP API or the CLI. The generated ZIP builds on its own with the Gradle
wrapper; Android Studio is optional.

> **Current scope:** Native Compose presets, declarative addons, deterministic ZIPs,
> material design tokens, web and CLI generation. Some addons remain beta pending
> instrumented runtime tests. No managed APK builds or cloud synchronization.

## Deploy the web app to Vercel

See [docs/deployment-vercel.md](docs/deployment-vercel.md) for the SSR adapter, Bun
lockfile update, monorepo root settings and production API smoke tests.

## Quick start (no Android Studio)

```bash
mise install                 # Bun, Node, JDK 21, just
bun install
just dev                     # Astro + SolidJS on http://localhost:4321
```

Open the configurator, generate a ZIP, then:

```bash
unzip demo-app.zip -d demo-app
cd demo-app
mise install
just sdk-setup               # read-only inspection; add INSTALL=1 to install packages
just doctor
just build                   # app/build/outputs/apk/debug/app-debug.apk
just test
just run                     # build + install + launch on the selected device
```

Windows: run the PowerShell scripts directly (`.\scripts\sdk-setup.ps1 -Install`),
or use `just` from Git Bash.

Full verification in this repository:

```bash
just check                   # typecheck + tests + template drift + web build
just android-smoke           # real assembleDebug + unit tests (needs Android SDK)
```

## What F0 actually does

- **Schema-first contracts** (`packages/schema`): `ProjectRequest`, `ThemeConfig`,
  `AddonManifest`, `GenerationPlan`, all strict Zod schemas with explicit limits.
- **Shared engine** (`packages/generator`): validate → resolve → plan → render →
  package. Web endpoints and the CLI call exactly the same functions.
- **Real template** (`templates/android-compose-minimal`): Kotlin, Compose M3,
  version catalog, wrapper with SHA-256, unit tests, `mise.toml`, `justfile`,
  SDK setup and device scripts for POSIX shells and PowerShell.
- **Deterministic ZIP**: sorted paths, fixed 1980-01-01 timestamps, STORE method,
  0644/0755 permissions, no data descriptors, path-traversal checks, 8 MB limit.
- **Plan/ZIP parity**: before download the archive is re-read and compared with
  the announced paths, sizes and SHA-256 hashes.
- **Declarative addons** (`addons/`): 18 planned entries across storage, UI,
  native and tooling. Planned/experimental addons are rejected by the resolver.
- **Design tokens** (`packages/design-tokens`): Material 3 schemes derived from a
  seed color, semantic overrides, typography, shape, spacing and component tokens.
  Kotlin code generation and the web preview share the same resolver.

## API

```bash
curl -s http://localhost:4321/api/catalog

curl -s -X POST http://localhost:4321/api/plan \
  -H 'content-type: application/json' --data @examples/basic.json

curl -s -X POST http://localhost:4321/api/generate \
  -H 'content-type: application/json' --data @examples/basic.json -o demo-app.zip
```

Errors are typed JSON (`INVALID_REQUEST`, `RESOLUTION_ERROR`, `LIMIT_EXCEEDED`,
`SECURITY_ERROR`, `TEMPLATE_ERROR`, `ZIP_ERROR`) with field-level issues. The
server never executes user input and never fetches remote templates.

## CLI

```bash
bun packages/cli/src/index.ts catalog
bun packages/cli/src/index.ts validate --config examples/basic.json
bun packages/cli/src/index.ts plan --config examples/basic.json --json
bun packages/cli/src/index.ts generate --config examples/basic.json --out demo-app.zip
```

`generate` refuses to overwrite an existing file unless `--force` is passed.

## Repository layout

```text
apps/web/                  Astro 7 + SolidJS configurator and API routes
packages/schema/           Zod contracts, identifiers, limits, typed errors
packages/catalog/          Validated addon registry (imports addons/*.json)
packages/resolver/         Dependency, conflict, SDK and status resolution
packages/generator/        Planner, renderer, deterministic ZIP, self-check
packages/design-tokens/    Theme resolution + Kotlin Compose code generation
packages/preview/          SolidJS Material 3 preview (web simulation)
packages/cli/              CLI over the shared engine
templates/                 Real Android template + local addon fragments
addons/                    Declarative addon manifests
examples/                  Example ProjectRequest
tests/                     Schema, resolver, generator, security, scripts, drift
docs/                      Architecture, compatibility, addon spec, ADRs, phases
```

## Documentation

- [Architecture](docs/architecture.md)
- [Compatibility matrix](docs/compatibility.md)
- [Addon specification](docs/addon-spec.md)
- [Design system](docs/design-system.md)
- [Native FFI contracts](docs/ffi.md)
- [F0 report](docs/phases/F0-foundation.md)
- [Roadmap](docs/roadmap.md)
- [ADRs](docs/adr/0001-foundation.md)
- [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md)

## License

MIT. See [LICENSE](LICENSE). External dependency licenses are listed in
[docs/compatibility.md](docs/compatibility.md).

## Runtime verification (F1.6A)

Use `just runtime-parser-test` without Android tools. With JDK 21 and a configured
Android SDK, `just android-runtime-compile` independently generates and compiles
all four implemented presets, runs JVM tests and compiles instrumented test APKs.
**This does not execute Android device tests.**

For explicit on-device verification, choose an authorized ADB serial and run:

```bash
ANDROID_SERIAL=emulator-5554 just android-test
```

The harness installs test apps on that specific device, runs the instrumented
JUnit suites, and emits a JSON report under `build/runtime-verification/`.
See [runtime testing](docs/runtime-testing.md) for setup, safety and statuses.

## Integrity and release evidence (F1.6C)

`just integrity-check` verifies all four presets as real ZIPs (determinism,
plan/ZIP parity, path and size limits, sensitive paths, Gradle Wrapper checksum)
without Android SDK or device access. Results are saved to
`build/integrity/report.json` and do not claim Android release readiness.

`just release-check` additionally reads opt-in runtime and benchmark reports.
Without executed instrumented tests on a device it reports **BLOCKED** (exit 78),
not PASS. `just patch-replay` reconstructs historical F0→F1.6B patches in a
throwaway local clone. Extract F1.6A, F1.6A.1, F1.6B ZIPs into `~/Downloads`
first; use `node scripts/integrity/patch-replay.mjs --downloads PATH` otherwise.
See `docs/integrity.md` for caveats, particularly R8 release settings, local
backup policy, transitive native dependencies, and the deferred i18n addon.

## Pruebas Android sin Android Studio

Con un SDK CLI instalado, consulta `just emulator-list` y `just emulator-images`. Si no hay AVD, `AVD_NAME=Initializr_API36 AVD_IMAGE='system-images;android-36;google_apis;x86_64' just emulator-create` crea uno **solo** si esa imagen ya está instalada; cambia el ID por uno que aparezca en tu equipo. Luego usa `AVD_NAME=Initializr_API36 just emulator-start`, `just runtime-devices`, `ANDROID_SERIAL=<serial-real> just android-test`. Detalles y requisitos en [F1.6F](docs/phases/F1.6F-cli-avd-provisioning.md).
