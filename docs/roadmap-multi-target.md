# Multi-target roadmap

Launchbed generates **android-compose** (owned templates) and can **delegate** to official CLIs for **expo** and **flutter**. Tauri and the React Native community CLI remain planned.

## Division that stays true on every stack

- **mise** pins tools, versions and non-secret env (`mise.toml`).
- **just** is the command catalog for complicated flows (build, test, run, FFI, release, signing).
- mise `[tasks]`, if present, only call just.
- Addons declare the targets they apply to. Centralized rules reject Compose UI packs, Android storage addons, and native FFI addons on Expo/Flutter with a stable `INCOMPATIBLE_ADDON` error.
- Conflicting tool versions or just recipe bodies fail before any files are written.

## Adapter model

| Target | Strategy | Status | Official CLI |
| --- | --- | --- | --- |
| Android / Kotlin + Compose | Owned | stable | — |
| Expo | Delegate, then overlays | beta | `npx --yes create-expo-app@5.0.0 <dir> --template default@sdk-58 --yes --no-agents-md` |
| Flutter | Delegate, then overlays | beta | `flutter create --template app --platforms android,ios,web --org <org> --project-name <dart_name> --android-language kotlin --empty --no-pub <dir>` (SDK 3.50.0 via mise) |
| Tauri 2 + SolidJS + `@solidjs/router` | Planned | planned | `npm create tauri-app@latest` (official Solid template) |
| Tauri 2 + Svelte | Planned | planned | Official Svelte template; verify SvelteKit + `tauri init` before promising it |
| React Native CLI | Planned (overlaps Expo) | planned | `npx @react-native-community/cli@latest init` |

`launchbed new --target expo|flutter` runs the official CLI (allowlisted argv, `shell: false`) and then writes Launchbed overlays: `mise.toml`, `justfile`, compiled DTCG tokens (`tokens/tokens.ts` + CSS for Expo; `lib/tokens/tokens.dart` + CSS for Flutter), GitHub Actions CI, `AGENTS.md`, `docs/EXPO.md` or `docs/FLUTTER.md`, and `launchbed.json`. The web/API never executes official CLIs; `/api/generate` returns a deterministic overlay-only ZIP (`<slug>-launchbed-overlay.zip`, verified against the plan) whose `LAUNCHBED_OVERLAY.md` explains both paths: `launchbed new …`, or the official command followed by `unzip -o` inside the new project. The official command is also sent in the `x-delegate-command` header.

## Design tokens, screens, and components

- One DTCG token source. The generator compiles it with Style Dictionary 5.8.0 at generate time into Compose Kotlin, `tokens/tokens.css`, `tokens/tokens.ts`, and `tokens/tokens.dart` / `lib/tokens/tokens.dart`. See `docs/design-system.md`.
- Shared screen contracts (login, onboarding, list/detail, settings, profile) are implemented for android-compose. Onboarding, auth (in-memory fake + validation tests), dashboard, notes, profile and settings are ported to Expo (expo-router, TSX) and Flutter (Dart) as a screen pack with bottom tabs, dark mode (System/Light/Dark in Settings) and local persistence (AsyncStorage 2.2.0 / shared_preferences 2.5.6); `app-starter` maps to them per target. The catalog screen is still Compose-only.
- Themes: 42 presets imported from tweakcn (Apache-2.0) apply to every target via `--theme <id>`; see `docs/THIRD_PARTY.md`.
- Cross-target addons (beta): `storage/key-value` (DataStore / AsyncStorage / shared_preferences), `network/http-client` (Ktor / fetch / package:http, typed results and timeouts, no backend URL or secrets) and `tooling/format` (ktlint / Prettier / dart format).
- A shadcn-style `registry/` ships Button, TextField, Card, ListItem, Badge, Switch, Avatar, AppBar, Snackbar, Dialog and Bottom Sheet for all three generatable targets. `launchbed add <component>` copies source into an existing project (detected via `launchbed.json`).
- Auth and FFI come after the visual pack is stable. Planned FFI paths: UniFFI on Kotlin, `flutter_rust_bridge` on Flutter, official Tauri plugins on Tauri.

## Suggested order (remaining)

1. Tauri + Solid (matches the existing SolidJS web app).
2. Tauri + Svelte.
3. React Native CLI, only if a distinct need remains after Expo.

## Compatibility and CI

A full cartesian product of stacks × addons will not run on every pull request. Android smoke stays on each PR when the SDK is present. Expo e2e is opt-in (`LAUNCHBED_E2E_EXPO=1`) and runs `launchbed new --target expo --preset app-starter --addon ui/notes`, `tsc --noEmit -p tsconfig.launchbed.json` (exit 0), `bun test src/launchbed` and `expo export --platform web`. Flutter e2e is opt-in (`LAUNCHBED_E2E_FLUTTER=1`) and runs `flutter analyze` plus `flutter test` on the app-starter screen pack. `launchbed doctor --target <id>` checks prerequisites.

## Still planned

Tauri and the React Native community CLI, the catalog screen on Expo/Flutter, a provider-neutral auth interface, ktlint-clean Compose templates (today `just format` fixes them), and device verification to move the beta addons to stable.
