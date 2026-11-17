# Compatibility and versions

Verified on 2026-11-13 against official sources. Every version is pinned; no
dynamic `+` versions. The generated template matrix lives in
`packages/generator/src/versions.ts`.

## Verified environment

| Tool | Observed |
| --- | --- |
| OS | Linux x86_64 |
| Bun | 1.4.4 |
| Node.js | 24.22.2 |
| JDK | Temurin 21.0.13+9.0.LTS |
| mise | 2026.10.13 |
| just | 1.59.0 |
| Android platform | android-37.0 |
| Build Tools | 36.0.0 (AGP default) |
| NDK | 28.2.13676358 (unused) |
| adb | 1.0.41 (platform-tools 37.0.1) |

## Android template matrix

| Component | Version | Constraint |
| --- | --- | --- |
| Android Gradle Plugin | 9.5.1 | Requires Gradle >= 9.6.0, JDK >= 17, max API 37, default Build Tools 36.0.0 |
| Gradle | 9.6.0 | Wrapper pins SHA-256 `bbaeb2fef8710818cf0e261201dab964c572f92b942812df0c3620d62a529a01` |
| Kotlin / KGP | 2.3.10 | AGP 9.5 supports 2.2.10+; pinned to 2.3.10 for KSP/Compose compiler alignment |
| Compose BOM | 2026.09.00 | Compose 1.12+ requires `compileSdk 37` and AGP 9 |
| activity-compose | 1.13.0 | Official Compose setup page |
| Room | 2.8.5 | room-runtime, room-compiler, room-gradle-plugin |
| KSP | 2.3.10 | symbol-processing-gradle-plugin; must match Kotlin |
| Compose compiler plugin | 2.3.10 | Must equal the Kotlin version |
| JUnit | 4.13.2 | Local unit tests |
| minSdk default | 26 | Allowed 24–37 |
| targetSdk default | 36 | Must be >= minSdk and <= compileSdk |
| compileSdk default | 37 | Allowed 34–37 |
| Java target | 17 | Compiled with the JDK 21 toolchain |

## Web and tooling matrix

| Package | Version | Notes |
| --- | --- | --- |
| astro | 7.4.12 | Node >= 22.23.4 |
| @astrojs/solid-js | 7.1.6 | peer solid-js ^1.9.13; Vite 8 |
| @astrojs/node | 11.1.13 | peer astro ^7.2.1; standalone server |
| solid-js | 1.9.19 | UI islands |
| typescript | 7.0.2 | `tsc --noEmit` |
| zod | 4.6.7 | Strict contracts |
| @material/material-color-utilities | 0.4.0 | HCT palettes (Apache-2.0) |
| style-dictionary | 5.8.0 | DTCG compile at generate time (custom Compose/CSS/Flutter formats) |
| scrcpy | 5.0.1 | Optional; pinned by tooling/scrcpy as github:Genymobile/scrcpy (mise GitHub and aqua backends verified) |
| GitHub Actions (generated) | checkout@v4, setup-java@v4, setup-android@v3, upload-artifact@v4 | Optional tooling/github-actions workflow: Temurin 21, unit tests, assembleDebug, lintDebug |

## Known issues and decisions

- **MCU ESM quirk:** 0.4.0 uses extensionless relative imports. It runs under
  Bun, Vite and the Astro bundle, but not under plain Node ESM. The web app is
  always bundled, so this is contained; do not import it from an unbundled Node
  entry point.
- **API 37 naming:** the SDK platform directory is `android-37.0`. The template
  sets `compileSdk = 37` and `scripts/sdk-setup.*` install
  `platforms/android-37.0`.
- **Built-in Kotlin:** AGP 9 does not use `org.jetbrains.kotlin.android`.
  Applying it fails; the template relies on built-in Kotlin and overrides KGP.
- **No dynamic versions:** no `+`, no `latest.release`, no remote templates.

## 16 KB page sizes

Apps targeting API 35+ must support 16 KB pages for Play updates from
2027-02-01. The generated template contains no native code, so it is unaffected.
Native addons must:

- build `.so` files with 16 KB ELF alignment (NDK r28+ default, or
  `-Wl,-z,max-page-size=16384 -Wl,-z,common-page-size=16384` on older NDKs);
- keep `.so` files uncompressed (AGP 8.5.1+ packages them aligned);
- use `sysconf(_SC_PAGESIZE)`/`getpagesize()` instead of a hard-coded page size.

## Licenses of external dependencies

MIT: this project, Astro, SolidJS, Zod, TypeScript.
Apache-2.0: AndroidX/Compose/Material 3, Android Gradle Plugin, Gradle, Kotlin,
Material Color Utilities, scrcpy, Turso/libSQL components.
Upstream licenses remain with their owners; no third-party binary is
redistributed by this repository except the official Gradle Wrapper JAR.

## Astro tooling

- `@astrojs/check` 0.9.12 requires TypeScript 5/6 and does not support 7.0. The
  repository therefore runs `astro check` with a local `typescript@6.0.3` in
  `apps/web`, while the root typecheck uses TypeScript 7.0.2.
- `just check` includes both `bun run typecheck` and `bun run check:astro`.
