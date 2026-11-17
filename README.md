# Launchbed — mobile-first starter generator

Generate **native Android** projects — Kotlin + Jetpack Compose Material 3 — from
the web, an HTTP API or the CLI. The generated project includes a Gradle wrapper,
a pinned `mise.toml` (tools and env) and a `justfile` (build, test, run and other
complex commands). Android Studio is optional.

This repository is the continuation of [Launchbed](https://github.com/jhovadev/launchbed)
under a new name. Workspace packages are `@launchbed/*`; the user-facing
command is `launchbed`.

> **Current scope:** Native Compose presets, declarative addons, deterministic
> ZIPs (and a project directory from `launchbed new`), mise + just in generated
> apps, web and CLI generation. Some addons remain beta pending instrumented
> runtime tests. Multi-target stacks (Expo, Flutter, Tauri, RN) are planned; see
> [docs/roadmap-multi-target.md](docs/roadmap-multi-target.md).

## Quick start (no Android Studio)

```bash
mise install                 # Bun, Node, JDK 21, just
bun install
just dev                     # Astro + SolidJS on http://localhost:4321
```

Or generate from the CLI:

```bash
bun packages/cli/src/index.ts new --yes --name "Demo App" --app-id com.example.demo --preset compose-minimal --out demo-app
cd demo-app
mise install
just doctor
just build
just test
just run
```

`launchbed new` writes a directory **and** a sibling ZIP (`demo-app.zip`). Pass
`--force` to replace an existing output. Without flags, an interactive prompt
runs when stdin is a TTY; use `--yes` in CI.

Open the web configurator, pick a preset, then download a ZIP, or copy the
equivalent `launchbed new` command shown in the review step.

Windows: run the PowerShell scripts in a generated project (`.\scripts\sdk-setup.ps1 -Install`),
or use `just` from Git Bash.

Full verification in this repository:

```bash
just check                   # typecheck + tests + template drift + web build
just android-smoke           # real assembleDebug + unit tests (needs Android SDK)
```

## mise and just

Generated projects follow a fixed split:

- **mise** (`mise.toml`) pins tools and env. No secrets. `mise install` and
  `mise exec` put the toolchain on `PATH`. Optional `[tasks]` are only shortcuts
  to `just` recipes (`mise run build` → `just build`).
- **just** (`justfile`) is the command catalog: `doctor`, `build`, `test`, `run`,
  SDK setup, and later FFI or release flows. Addons may contribute extra recipes
  and mise tools; conflicting recipe bodies or tool versions fail before any
  files are written.

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
bun packages/cli/src/index.ts new --yes --preset compose-starter --out starter-app
bun packages/cli/src/index.ts validate --config examples/basic.json
bun packages/cli/src/index.ts plan --config examples/basic.json --json
bun packages/cli/src/index.ts generate --config examples/basic.json --out demo-app.zip
```

`generate` still writes a ZIP only. Prefer `new` when you want a ready directory.
`--addon` may be repeated. `generate` and `new` refuse to overwrite unless `--force`
is passed.

## Repository layout

```text
apps/web/                  Astro 7 + SolidJS configurator and API routes
packages/schema/           Zod contracts, identifiers, limits, typed errors
packages/catalog/          Validated addon registry (imports addons/*.json)
packages/resolver/         Dependency, conflict, SDK and status resolution
packages/generator/        Planner, renderer, deterministic ZIP, self-check
packages/design-tokens/    Theme resolution + Compose token code generation
packages/preview/          SolidJS Material 3 preview (web simulation)
packages/cli/              launchbed CLI over the shared engine
templates/                 Real Android template + local addon fragments
addons/                    Declarative addon manifests
examples/                  Example ProjectRequest
tests/                     Schema, resolver, generator, security, scripts, drift
docs/                      Architecture, compatibility, addon spec, ADRs, phases
AGENTS.md                  How to work in this repo (humans and coding agents)
```

## Documentation

- [AGENTS.md](AGENTS.md) — commands that exist, rules, how to add addons
- [Architecture](docs/architecture.md)
- [Compatibility matrix](docs/compatibility.md)
- [Addon specification](docs/addon-spec.md)
- [Design system](docs/design-system.md)
- [Native FFI contracts](docs/ffi.md)
- [F0 report](docs/phases/F0-foundation.md)
- [Historical roadmap](docs/roadmap.md)
- [Multi-target roadmap](docs/roadmap-multi-target.md)
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
not PASS. See `docs/integrity.md` for caveats.

## Pruebas Android sin Android Studio

Con un SDK CLI instalado, consulta `just emulator-list` y `just emulator-images`. Si no hay AVD, `AVD_NAME=Launchbed_API36 AVD_IMAGE='system-images;android-36;google_apis;x86_64' just emulator-create` crea uno **solo** si esa imagen ya está instalada; cambia el ID por uno que aparezca en tu equipo. Luego usa `AVD_NAME=Launchbed_API36 just emulator-start`, `just runtime-devices`, `ANDROID_SERIAL=<serial-real> just android-test`. Detalles y requisitos en [F1.6F](docs/phases/F1.6F-cli-avd-provisioning.md).
