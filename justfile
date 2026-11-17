set shell := ["bash", "-euo", "pipefail", "-c"]

# Launchbed workspace tasks. This file is for the Launchbed repository.
# Generated Android projects ship their own justfile (mise for tools, just for commands).

default:
    @just --list

# Install workspace dependencies with Bun
install:
    bun install

# Start the Astro + SolidJS dev server
dev:
    bun run dev

# Typecheck TypeScript (packages, scripts and web client code)
typecheck:
    bun run typecheck

# Run schema, catalog, resolver, generator and security tests
test:
    bun test packages tests

# Verify that the embedded template bundle matches templates/
templates-check:
    bun run templates:check

# Re-embed template files after editing templates/android-compose-minimal
templates-embed:
    bun run templates:embed

# Build the production web server
build: templates-check
    bun run build

# Run the built web server
start:
    bun run preview

# Generate the example project ZIP through the CLI engine
generate:
    bun run generate:example

# Full local verification (no Android SDK required)
check: typecheck check-astro test templates-check build

# Real Android smoke test (requires JDK 21 + Android SDK 37)
android-smoke:
    bun run scripts/android-smoke.ts

# Print tool versions relevant to the project
doctor:
    @echo "bun      $(bun --version 2>/dev/null || echo MISSING)"
    @echo "node     $(node --version 2>/dev/null || echo MISSING)"
    @echo "java     $(java -version 2>&1 | head -1 || echo MISSING)"
    @echo "just     $(just --version 2>/dev/null || echo MISSING)"
    @echo "ANDROID_HOME ${ANDROID_HOME:-unset}"
    @echo "ANDROID_SDK_ROOT ${ANDROID_SDK_ROOT:-unset}"

# Typecheck .astro files (astro check; uses TypeScript 6 locally for compatibility)
check-astro:
    bun run check:astro

# F1.6A: pure device parser tests (Node, no Android SDK required)
runtime-parser-test:
    node --test scripts/runtime/*.node.test.mjs

# Read-only Android runtime checks
runtime-doctor:
    bun run scripts/android-runtime.ts doctor

runtime-devices:
    bun run scripts/android-runtime.ts devices

# F1.6E: read-only readiness check of an authorized, fully booted device.
runtime-device-check:
    bun run scripts/android-runtime.ts device-check

emulator-list:
    bun run scripts/android-runtime.ts emulator-list

# F1.6F: list locally installed system images; no downloads or mutations.
emulator-images:
    node scripts/runtime/avd-provision.mjs images

# Explicitly create one AVD using an already installed image. No SDK installation.
# AVD_NAME and AVD_IMAGE must be supplied; existing AVDs cannot be overwritten.
emulator-create:
    node scripts/runtime/avd-provision.mjs create

# Pure CLI AVD provisioning tests; no Android SDK or device required.
emulator-provision-test:
    node --test scripts/runtime/avd-provision.node.test.mjs

# Explicitly start the AVD specified by AVD_NAME; never downloads SDK images.
emulator-start:
    bun run scripts/android-runtime.ts emulator-start

# Explicitly stop emulator specified by ANDROID_SERIAL; refuses physical devices.
emulator-stop:
    bun run scripts/android-runtime.ts emulator-stop

# Build + lint + JVM tests + compile instrumentation APKs for all presets.
android-runtime-compile:
    bun run scripts/android-runtime.ts test --all

# Execute instrumented suites on the selected ADB serial (ANDROID_SERIAL).
android-test:
    bun run scripts/android-runtime.ts test --all --run

android-test-room:
    bun run scripts/android-runtime.ts test --preset local-notes --run

android-test-ui:
    bun run scripts/android-runtime.ts test --preset compose-starter --run

# F1.6B: generation benchmark (no Android SDK needed; ignored JSON report).
benchmark-generator:
    bun run scripts/performance-baseline.ts generator

# F1.6B: fixed-directory Gradle benchmark for the minimal preset (SDK required).
benchmark-android:
    bun run scripts/performance-baseline.ts android

# F1.6B: pure Node benchmark helper tests (no Bun/SDK required).
benchmark-parser-test:
    node --test scripts/performance/metrics.node.test.mjs

# F1.6C: deterministic source ZIP, license and sensitive-file checks; no Android SDK required.
integrity-check:
    bun run scripts/integrity-check.ts

# Verify historical F0 -> F1.6B patch chain in a disposable clone, with external ZIPs extracted to ~/Downloads.
patch-replay:
    node scripts/integrity/patch-replay.mjs

# Only reports PASS with actual device instrumentation + benchmark evidence; exit 78 if BLOCKED.
release-check:
    bun run scripts/integrity-check.ts --release

# Pure parser/classifier tests, no device or SDK required.
integrity-parser-test:
    node --test scripts/integrity/gates.node.test.mjs

# F1.6D: checks native ELF/ZIP structure and release-evidence classifier without an SDK.
release-parser-test:
    node --test scripts/release/native-apk.node.test.mjs

# Opt-in: generates all four unsigned optimized release APKs and performs static audit.
# Requires a configured JDK 21 + Android SDK; does NOT use a phone or sign APKs.
release-audit:
    bun run scripts/release-audit.ts build --all

# F1.7A: require installed/pinned Vercel adapter and synchronized Bun lockfile.
vercel-preflight:
    node scripts/deployment/preflight.mjs

# Verify that Vercel's SSR adapter can produce a deployment bundle locally.
vercel-build: vercel-preflight
    LAUNCHBED_DEPLOY_TARGET=vercel bun run build

# Probe the live Vercel URL (LAUNCHBED_DEPLOY_URL is required).
vercel-smoke:
    node scripts/deployment/vercel-smoke.mjs

# Generate the example project into a directory plus ZIP (CLI new)
cli-new:
    bun packages/cli/src/index.ts new --yes --force --out build/example-app
