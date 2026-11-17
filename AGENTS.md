# Launchbed — guide for humans and coding agents

Launchbed generates **native Android** starters (Kotlin + Jetpack Compose Material 3) from a shared TypeScript engine used by the web UI, HTTP API and CLI. This repository used to be published as Launchbed / Launchbed. User-facing branding is Launchbed; workspace packages are still named `@launchbed/*`.

Do not invent commands. The lists below exist in this repo today.

## Everyday commands

From the repository root, after `mise install` and `just install` (or `bun install --frozen-lockfile`):

| Task | Command |
| --- | --- |
| Dev server (http://localhost:4321) | `just dev` |
| Typecheck | `just typecheck` |
| Unit tests | `just test` |
| Template drift check | `just templates-check` |
| Re-embed templates after editing `templates/` | `just templates-embed` |
| Typecheck + tests + template check + web build | `just check` |
| Example ZIP via `generate` | `just generate` |
| Example directory + ZIP via `launchbed new` | `just cli-new` |
| Tool versions | `just doctor` |
| Real `assembleDebug` + JVM tests | `just android-smoke` (needs JDK 21 + Android SDK 37) |

CLI (same engine as the API):

```bash
bun packages/cli/src/index.ts new --yes --name "Demo App" --app-id com.example.demo --preset compose-minimal --out demo-app
bun packages/cli/src/index.ts catalog
bun packages/cli/src/index.ts plan --config examples/basic.json --json
```

`new` writes a directory and a sibling ZIP. `--addon` is repeatable. `--yes` is required when stdin is not a TTY. `generate` still writes a ZIP only.

Optional Android / integrity recipes also exist: `just runtime-parser-test`, `just integrity-check`, `just runtime-devices`, `just emulator-list`, `just android-test` (needs `ANDROID_SERIAL`). See `just --list`. Deploy smokes: `just vercel-preflight`, `just vercel-smoke` (the script still reads `LAUNCHBED_DEPLOY_URL`).

## Architecture

The pipeline is documented in `docs/architecture.md`:

`ProjectRequest` → Zod validation → addon resolution → theme tokens → **Style Dictionary 5.8.0 compiles the DTCG document to Compose, CSS and Flutter outputs (generator time, not app runtime)** → render template + fragments → addon composition (add / insert / merge) → **mise.toml + justfile tooling merge** → limits / path checks → deterministic ZIP with plan/ZIP parity.

Web routes in `apps/web/src/pages/api/*` and `packages/cli` only parse input and call `packages/generator`. Do not reimplement generation in the UI.

Generated apps: mise pins tools and env (no secrets). just is the command catalog (`doctor`, `build`, `test`, `run`, …). mise `[tasks]` are shortcuts to just. Addon `tooling` contributions are merged deterministically; conflicting tool versions or recipe bodies fail before files are written. See `docs/addon-spec.md`. Android Compose addons now include onboarding (DataStore), auth (login/register with an in-memory fake — not a real backend; see `docs/auth-backends.md`) and profile; the `app-starter` preset composes them with dashboard and settings.

## Rules

- Pin every new dependency and record it in `docs/compatibility.md`.
- Design tokens: W3C DTCG in `design-tokens.json`. Style Dictionary 5.8.0 compiles them at generate time via `@launchbed/design-tokens/style-dictionary`. Do not import that subpath from the web preview. Custom formats must stay deterministic (no timestamps, no Prettier). See `docs/design-system.md`.
- No remote templates, no executing user input, no dynamic `+` versions, no secrets or keystores in templates.
- Do not claim a feature works without a test or a real command proving it.
- Keep changes small. Conventional Commits, subject ≤ 72 characters.
- Do not use `git am` or `git apply` when preparing a delivery for the maintainer; prefer a ZIP of changed files plus a `.patch` for inspection, applied by unzip + `git add`.
- Do not push or write to remotes unless the user explicitly asked for that exact action.
- Multi-target: `android-compose` is owned; `expo` and `flutter` are beta delegate adapters (`launchbed new --target …`). Tauri and the RN community CLI are still planned. See `docs/roadmap-multi-target.md`.
- Component registry: `launchbed components --json` and `launchbed add <component>` copy shadcn-style sources (Button, TextField, Card, ListItem, Badge, Switch, Avatar, AppBar, Snackbar, Dialog) into a project that has `launchbed.json`. The registry is embedded into `packages/generator/src/registry.generated.ts` by `bun run templates:embed` (Node SSR/Vercel never read `registry/` from disk).
- Web UI (`apps/web`): Tailwind v4 + shadcn-style tokens in `src/styles/global.css`; `Button`/`Badge` in `src/components/ui/` are copied from solid-ui (MIT). Tabs and segmented controls are hand-written WAI-ARIA (no Kobalte primitives in islands, they broke Astro hydration). The phone preview (`packages/preview`) is illustrative and must mirror the generated screens.
- `launchbed doctor [--target <id>]` checks local prerequisites. The web/API never runs official CLIs for delegate targets; it returns the plan and command.

## Device and scrcpy recipes

Every generated Android project ships `just` recipes that use the existing
`ANDROID_SERIAL` validation in `scripts/device.sh` / `device.ps1`: `devices`,
`install`, `run` / `launch`, `logs` / `logcat`, `screenshot`, `clear-data`,
`uninstall`, `deeplink`, plus `mirror`, `mirror-wifi` and `record` (scrcpy).

The opt-in addon `tooling/scrcpy` pins `github:Genymobile/scrcpy` `5.0.1` in
`mise.toml`. That backend (and `aqua:Genymobile/scrcpy`) was verified to list
and install the official 5.0.1 release. Distro packages are often obsolete;
`just doctor` prints OS-specific install instructions when scrcpy is missing.
Do not invent scrcpy flags: use the official ones (`--record`, `--no-audio`,
`--tcpip`, `--stay-awake`, `--turn-screen-off`, `--video-codec`, `--max-size`,
`--new-display`, `--camera`, …).

## Generated project CI

The beta `tooling/github-actions` addon writes `.github/workflows/ci.yml` and
`docs/CI.md`. The workflow pins Actions by commit SHA, validates the Gradle
wrapper, uses `setup-gradle` for the dependency cache, and sets concurrency
with a safe `${{ github.workflow }}-${{ github.ref }}` group. It uses Temurin
21, installs platform `android-37.0` and build-tools `36.0.0`, then runs
`./gradlew :app:testDebugUnitTest`, `:app:assembleDebug`, and `:app:lintDebug`.
It does not interpolate secrets and does not sign a release APK.
`compose-starter` and `app-starter` include it; other presets can pass
`--addon tooling/github-actions`. Delegate targets write their own overlay
workflows (Expo export / Flutter analyze).

## How to add an addon

1. Read `docs/addon-spec.md` and the skill `.agents/skills/add-addon/SKILL.md`.
2. Start as `planned` under `addons/<category>/<name>.json` with no `fileOperations` and empty `tooling`.
3. Implement fragments under `templates/fragments/`, file operations, resolver tests, and only then set `beta` or `stable`.
4. If the addon needs tools or just recipes, declare them in `tooling`. Never reuse a reserved just recipe name (`doctor`, `build`, `test`, `run`, …).
5. Run `just templates-embed` if you edited templates or fragments, then `just check`.

## How to add a preset

1. Read `.agents/skills/add-preset/SKILL.md`.
2. Add `presets/<id>.json` and register it in `packages/catalog/src/presets.ts`.
3. Required addons must already be generatable. `planned` presets cannot be generated.
4. Add or extend tests that materialize the preset. Run `just test`.

## How to generate and verify a project

See `.agents/skills/generate-and-verify/SKILL.md`. Typical path: `launchbed new --yes …`, then in the output directory `mise install`, `just doctor`, `just test`, `just build`. In this repo, `just check` covers the generator; `just android-smoke` covers a real Gradle build when the SDK is present.

## How to update compatibility versions

See `.agents/skills/update-compatibility/SKILL.md`. Change versions in `packages/generator/src/versions.ts` (including `GENERATED_MISE`) and `docs/compatibility.md` together, re-embed if the Android template catalogs change, and run `just check` plus `just android-smoke` when Gradle/SDK versions move.

## What not to touch

- Real devices, production keystores, or secrets.
- Historical files under `patches/` (they document past reviews).
- Business data, if any appears in a local environment.
- A wholesale rename of `@launchbed/*` packages unless a dedicated, tested change is requested.
- Do not mark additional adapters (Tauri, RN community CLI) as implemented until they have tests and a generator path. Expo and Flutter are already generatable as delegates.
