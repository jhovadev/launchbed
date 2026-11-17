---
name: update-compatibility
description: Update pinned Launchbed toolchain versions in versions.ts, docs/compatibility.md, mise.toml and generated projects together.
---

# Update compatibility versions

Pinned versions have a single code source in `packages/generator/src/versions.ts` (`TOOLCHAIN` and `GENERATED_MISE`) and must stay aligned with `docs/compatibility.md`.

## Steps

1. Verify the new versions against official docs. Record the date and source in `docs/compatibility.md`.
2. Update `TOOLCHAIN` (AGP, Gradle, Kotlin, Compose, …) and `GENERATED_MISE` (java, just, `min_version`) together.
3. If Gradle wrapper properties, version catalogs or template scripts change, edit `templates/android-compose-minimal` and run `just templates-embed`.
4. The workspace root `mise.toml` may need the same Bun, Node, JDK or just pins.
5. Run `just check`. If Android compiler or SDK pins changed, also run `just android-smoke` when the SDK is available.
6. Do not use dynamic versions (`+`, `latest.release`).
