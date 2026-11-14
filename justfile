set shell := ["bash", "-euo", "pipefail", "-c"]

# Android Initializr workspace tasks. This file is for the Initializr repository.
# Generated Android projects ship their own justfile.

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
check: typecheck test templates-check build

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
