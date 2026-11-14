# Addon specification

Addons are declarative manifests under `addons/<category>/<name>.json`. They are
validated by `AddonManifestSchema` at module load. A malformed manifest fails
tests and the build; it is a repository defect, not a user error.

## Manifest

```json
{
  "id": "storage/room",
  "version": "0.1.0",
  "displayName": "Room (SQLite)",
  "description": "Type-safe local persistence on SQLite.",
  "category": "storage",
  "status": "planned",
  "dependencies": [],
  "conflicts": ["storage/sqlite-direct"],
  "capabilities": ["persistence", "local-database"],
  "requirements": { "minSdk": 24, "compileSdk": 34, "jdk": 17 },
  "fileOperations": [],
  "compatibility": { "android": ["7.0+"], "notes": ["Planned."] },
  "license": "MIT",
  "docsUrl": "https://developer.android.com/training/data-storage/room"
}
```

Rules enforced by the schema:

- `id` matches `^[a-z][a-z0-9-]*/[a-z][a-z0-9-]*$` and its prefix equals `category`.
- `version` is semantic (`MAJOR.MINOR.PATCH`).
- `status` is `stable`, `beta`, `experimental` or `planned`.
- `dependencies` and `conflicts` cannot contain the addon itself or each other.
- `capabilities` are unique kebab-case identifiers.
- `fileOperations[].template` references a local fragment id, never a URL.
- `fileOperations[].path` is a safe relative path (no traversal, no absolute path).
- `planned` addons must not declare file operations.
- `stable` and `beta` addons must declare at least one file operation.
- Unknown keys are rejected.

## Status semantics

| Status | Generated? | Meaning |
| --- | --- | --- |
| `stable` | Yes | Implemented, tested in CI |
| `beta` | Yes, with warning | Implemented but may change |
| `experimental` | No | Design spike; rejected by the resolver |
| `planned` | No | Declarative roadmap entry |

The resolver rejects planned and experimental addons with an explicit message.
The catalog API exposes `generatable`, and the web UI disables those checkboxes.
F0 has no generatable addon; the generated project is the minimal template.

## File operations

```json
{ "type": "add", "path": "app/src/main/.../Database.kt", "template": "storage/room-database" }
{ "type": "append", "path": "app/build.gradle.kts", "template": "storage/room-dependency" }
```

- `add` fails if the target already exists.
- `append` fails if the target is missing or binary.
- `modify` is parsed but **not implemented** in F0 and fails closed.
- Fragments live in `templates/fragments/<template>.txt`, are local and are
  rendered with the same trusted template variables as the base template.

## Resolution

`resolveAddons` performs: existence check → status check → transitive dependency
closure with cycle/depth detection → pairwise conflict detection → requirement
merge (max minSdk/compileSdk/jdk) → request compatibility check → warnings for
beta addons. Tests cover conflicts, cycles, missing dependencies, SDK floors and
planned/experimental rejection.
