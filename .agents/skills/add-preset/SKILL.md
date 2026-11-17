---
name: add-preset
description: Add a Launchbed project preset JSON, register it in the catalog, and cover it with generator tests.
---

# Add a Launchbed preset

Use this skill when adding a starting point such as `compose-minimal` or `local-notes`.

## Steps

1. Copy an existing file in `presets/` and follow `packages/schema/src/preset.ts`.
2. `requiredAddons` must already be generatable (`stable` or `beta` with file operations). Do not point a generatable preset at planned addons.
3. Register the JSON in `packages/catalog/src/presets.ts`.
4. Add a test that calls `materializeProject` or `generateProject` with `preset: "<id>"` and asserts the resolved addons and key files.
5. `planned` presets stay visible in the catalog/UI but cannot be generated.
6. Run `just test`.
