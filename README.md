# Android Initializr

Generate **native Android** projects — Kotlin + Jetpack Compose Material 3 — from the
web, an HTTP API or the CLI. The generated ZIP builds on its own with the Gradle
wrapper; Android Studio is optional.

> **F0 status:** foundation and architecture. One real template, one shared
> generation engine, a declarative addon catalog, deterministic ZIPs and verified
> Android builds. No authentication, Turso Sync, production FFI plugins, remote
> APK builds or plugin marketplace yet.

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
