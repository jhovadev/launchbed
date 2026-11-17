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

## Operations (F1.0)

All operations are strict Zod objects. Fragments are local trusted files; no
user regex, `eval`, remote download or text replacement is involved.

### add

```json
{ "type": "add", "path": "app/src/main/.../Database.kt", "template": "storage/room-database" }
```

Creates a file. Fails if it exists or targets a protected template path
(Gradle files, wrapper, `local.properties`, ...).

### insert

```json
{ "type": "insert", "path": "app/build.gradle.kts", "slot": "app-dependencies", "template": "storage/room-dependency" }
```

Slots are declared in trusted templates as `// @launchbed-slot <id>`. All four
slots must exist exactly once; a missing, duplicated or moved marker is a
`TEMPLATE_ERROR`. Contributions are ordered by addon id, so selection order does
not change bytes.

### merge

```json
{ "type": "merge", "target": "version-catalog", "alias": "androidx-room", "module": "androidx.room:room-runtime", "versionRef": "room" }
{ "type": "merge", "target": "app-dependencies", "alias": "androidx-room" }
{ "type": "merge", "target": "app-plugins", "alias": "ksp" }
{ "type": "merge", "target": "root-plugins", "alias": "ksp" }
{ "type": "merge", "target": "settings-includes", "module": ":feature:home" }
```

Catalog merges are parsed with a TOML parser and serialized deterministically
(sorted sections and keys, quoted keys only when required). Existing entries are
preserved. `versionRef` must exist; `version` creates a version alias named after
the library alias. Identical aliases are deduplicated; incompatible modules or
versions are rejected before generation.

### modify / append

Accepted by the schema for backward compatibility and always rejected at
execution with a typed error. They must not be used by new addons.

## Resolution

`resolveAddons` performs: existence check → status check → transitive dependency
closure with cycle/depth detection → pairwise conflict detection → requirement
merge (max minSdk/compileSdk/jdk) → request compatibility check → warnings for
beta addons. Tests cover conflicts, cycles, missing dependencies, SDK floors and
planned/experimental rejection.

## Reference: storage/room (F1.1)

- Status: `stable`, generatable.
- Slots used: `root-plugins`, `app-plugins`, `app-dependencies`, `app-room-config`.
- Catalog aliases: `room`, `ksp`, `roomruntime`, `roomcompiler`, `androidxtestextjunit`.
- Generated files: `NoteEntity`, `NoteDao`, `AppDatabase`, `DatabaseProvider`,
  `NoteRepository`, plus JVM and instrumented tests.
- Schema export: `app/schemas/<db>/<version>.json` during build.
- No KAPT, Hilt, Koin, remote sync, CRUD UI or destructive migrations.

## Reference: UI addons (F1.2)

- `ui/navigation`: stable beta, generates `AppRoot`, `WelcomeScreen`, typed
  `AppRoute`, and Navigation 3 dependencies. Uses slots `app-imports`,
  `app-routes`, `app-entries`, `main-content`.
- `ui/dashboard`: depends on `ui/navigation`; generates `DashboardScreen`.
- `ui/settings`: depends on `ui/navigation`; generates `SettingsScreen`.
- Navigation 3 1.2.1, kotlinx.serialization 1.8.1, serialization plugin 2.3.10.
- No Navigation Compose 2.x, no Hilt/Koin, no DataStore, no CRUD UI.

## Reference: ui/catalog (F1.5)

- Status: `beta`, generatable.
- Standalone demo catalog screen with local search and empty state.
- No backend, payments or persistence.


## Tooling contributions (mise + just)

Optional `tooling` on a generatable addon declares:

- `tools`: pinned mise tool names and versions (merged into generated `mise.toml`). Names may be short (`java`) or backend identifiers (`github:Genymobile/scrcpy`); keys that are not bare TOML are quoted.
- `env`: non-secret environment keys (rejected if the key looks like a secret)
- `justRecipes`: named just recipes inserted above `# @launchbed-slot just-recipes`

The generator always writes a canonical `mise.toml` with the Java and just
versions from `docs/compatibility.md`, plus optional `[tasks]` that only call
`just`. Reserved recipes (`doctor`, `build`, `test`, `run`, and the other base
template tasks) cannot be redefined. Two addons may contribute the same tool
version or an identical recipe body (they are deduplicated). A different version
or a different body is a `RESOLUTION_ERROR` and no project is written.

Planned and experimental addons must leave `tooling` empty.
