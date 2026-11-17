# Multi-target roadmap (plan)

This is a **plan**, not a description of shipped features. Today Launchbed generates only native Android (Kotlin + Jetpack Compose) projects. Other stacks will be added as adapters on top of the existing engine (schema, resolver, deterministic plan, mise/just merge).

## Division that will stay true on every stack

- **mise** pins tools, versions and non-secret env (`mise.toml`).
- **just** is the command catalog for complicated flows (build, test, run, FFI, release, signing).
- mise `[tasks]`, if present, only call just.
- Addons declare compatible implementations per target (storage, auth, FFI) plus tools and just recipes.
- Conflicting tool versions or just recipe bodies fail before any files are written.

## Adapter model

| Target | Strategy | Official CLI to delegate |
| --- | --- | --- |
| Android / Kotlin + Compose | **Owned** (current engine and templates) | — |
| Expo | Delegate, then post-process | `npx create-expo-app@latest` (pin the template/SDK explicitly) |
| Flutter | Delegate, then post-process | `flutter create` |
| Tauri 2 + SolidJS + `@solidjs/router` | Delegate + optional `tauri android init` | `npm create tauri-app@latest` (official Solid template) |
| Tauri 2 + Svelte | Delegate later | Official Svelte template; SvelteKit may need a manual `tauri init` — verify before promising it |
| React Native CLI | Last, overlaps Expo | `npx @react-native-community/cli@latest init` |

Post-processing adds the Launchbed `mise.toml`, `justfile`, design tokens and shared screen pack. Official templates are not rewritten in full.

## Design tokens and screens

- One DTCG token source. Android Compose already receives a generated `design-tokens.json` (W3C DTCG) and the Kotlin theme is derived from it with a deterministic transformer. Style Dictionary (or the same transformer) will later emit Flutter and CSS from that same document so products share color, type and spacing.
- Shared screen contracts first: login, onboarding, list/detail, settings, profile. Same information architecture; not pixel-perfect across engines. Today, catalog/notes (list/detail) and settings are generated addons; login, onboarding, register and a dedicated profile screen stay planned.
- Auth and FFI come after the visual pack is stable. Planned FFI paths: UniFFI on Kotlin, `flutter_rust_bridge` on Flutter, official Tauri plugins on Tauri.

## Suggested order

1. Keep improving the owned Android path (current work).
2. Expo adapter (fastest second mobile target).
3. Flutter.
4. Tauri + Solid (matches the existing SolidJS web app).
5. Tauri + Svelte.
6. React Native CLI.

## Compatibility and CI

A full cartesian product of stacks × addons will not run on every pull request. Use an include-only / pairwise matrix: Android smoke on each PR; Expo/Flutter/Tauri on a nightly or opt-in job. Each adapter has a `doctor` for its prerequisites.

## Out of scope until the plan is scheduled

Implementing those adapters, shipping a shared token pipeline, or marking Expo/Flutter/Tauri/RN as generatable targets.
