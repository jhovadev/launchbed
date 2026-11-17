---
name: add-addon
description: Add a Launchbed addon manifest, fragments, tests and optional mise/just tooling contributions.
---

# Add a Launchbed addon

Use this skill when creating or promoting an addon under `addons/`.

## Steps

1. Read `docs/addon-spec.md` and `packages/schema/src/addon.ts`.
2. Add `addons/<category>/<name>.json`. The `id` prefix must equal `category`. Start as `planned` with empty `fileOperations` and empty `tooling`.
3. Import the JSON in `packages/catalog/src/index.ts` and add it to `RAW_MANIFESTS`.
4. When implementing: add trusted fragments under `templates/fragments/`, declare `add` / `insert` / `merge` operations only (never `modify` or `append`), and run `just templates-embed`.
5. Optional `tooling.tools`, `tooling.env` (no secret-like keys) and `tooling.justRecipes`. Recipe names must not collide with reserved base recipes (`doctor`, `build`, `test`, `run`, `lint`, `sdk-setup`, …). Conflicting versions or bodies fail generation.
6. Add resolver and generator tests (conflicts, dependencies, SDK floors, determinism). Move status to `beta` or `stable` only when tests exist.
7. Run `just check`.

Do not fetch remote templates or execute user-supplied scripts.
