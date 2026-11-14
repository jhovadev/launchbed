# ADR 0001: F0 foundation and shared TypeScript engine

- **Status:** Accepted
- **Date:** 2026-11-13

## Context

The project must generate native Android projects from a web configurator and a
CLI without duplicating behavior, and must grow through small auditable patches.
A large initial scaffold with many services would be harder to verify than one
that produces a real, independently buildable app.

## Decision

1. Use a Bun workspace monorepo with Astro 7 (pages) and SolidJS 1.9 (islands).
2. Keep the generation engine in dependency-free TypeScript packages:
   `schema`, `catalog`, `resolver`, `design-tokens`, `generator`.
3. Implement **one** pipeline in `packages/generator`; the API routes and CLI are
   thin adapters.
4. Ship exactly one real template, `android-compose-minimal`, with its own Gradle
   wrapper, version catalog, tests, `mise.toml`, `justfile` and scripts.
5. Embed template sources at build time through a drift-checked codegen step, so
   no runtime filesystem or network is needed by the engine.
6. Use a deterministic ZIP writer (STORE, fixed timestamps, normalized modes) and
   verify the archive against the `GenerationPlan` before returning it.
7. Make all non-F0 features (`planned`/`experimental` addons) non-generatable
   rather than emitting placeholder code.

## Consequences

- Web and CLI cannot diverge; tests cover the shared engine.
- Generated apps do not depend on the monorepo at runtime.
- Updating a template requires re-running `templates:embed`; CI enforces it.
- No Android Studio requirement; the CLI path is the primary path.
- Addon implementation is deferred, but its contract and resolver exist and are
  tested.
