# Architecture

## Non-negotiable constraints

1. Generated apps are native Android: Kotlin + Jetpack Compose Material 3.
2. Android Studio is optional. JDK, SDK command-line tools, Gradle Wrapper and an
   editor are sufficient.
3. The web app is Astro for structure and SolidJS for interactivity, with Bun as
   the workspace package manager/runtime.
4. The generation engine is plain TypeScript and has no Astro, browser or CLI
   dependency.
5. Templates are local files. There is no remote template fetching and no user
   script execution.
6. Generated projects must compile independently of this monorepo.

## Pipeline

```text
ProjectRequest (JSON)
  -> schema validation (Zod, strict objects, identifiers, SDK relations, limits)
  -> normalization (packageName defaults, addons sorted and deduplicated)
  -> addon resolution (existence, status, dependencies, conflicts, SDK floors)
  -> theme resolution (Material 3 token derivation)
  -> plan + render (templates, generated Kotlin, addon file operations)
  -> limits and path validation
  -> GenerationPlan (sorted paths, sizes, SHA-256, request hash)
  -> deterministic ZIP (STORE, fixed timestamps, normalized permissions)
  -> ZIP is re-read and compared with the plan
```

`packages/generator/src/plan.ts` owns this pipeline. `apps/web/src/pages/api/*`
and `packages/cli` only parse input, call the engine and present the result, so
web and CLI behavior cannot drift apart.

## Package responsibilities

| Package | Responsibility | Must not |
| --- | --- | --- |
| `schema` | Contracts, limits, identifier/path validation, typed errors | Read files, render templates |
| `catalog` | Validate `addons/*.json` at module load, expose catalog entries | Generate code |
| `resolver` | Dependency closure, cycles, conflicts, requirement merge, status gating | Render or package |
| `design-tokens` | Theme resolution and Compose token code generation | Read templates |
| `generator` | Planning, rendering, limits, deterministic ZIP, plan/ZIP verification | Know about Astro or HTTP |
| `preview` | SolidJS approximation of the generated screen | Claim runtime equivalence |
| `cli` | Argument parsing and file output | Reimplement generation |
| `apps/web` | Astro pages, SolidJS island, API routes | Own business rules |

## Why templates are embedded

The template sources live as real files under
`templates/android-compose-minimal`. `scripts/embed-templates.ts` embeds them
(including the binary Gradle wrapper JAR, base64) into
`packages/generator/src/templates.generated.ts`. This keeps the generator free
of runtime filesystem assumptions in Astro SSR, Bun and tests. CI runs
`just templates-check`, and `tests/templates.test.ts` compares the bundle with
the files on disk, so the two cannot silently diverge.

## Determinism

- Files are sorted by POSIX path before planning and packaging.
- The request hash uses a stable stringify with lexicographic key ordering.
- ZIP entries use the STORE method, DOS timestamp 1980-01-01, UTF-8 flag,
  external attributes 0644 (0755 only for `gradlew` and `scripts/*.sh`).
- No timestamps, random values, environment variables or locale-dependent
  ordering are used.
- `generateProject` verifies the finished ZIP against the plan before returning.

## Security model

- Input is validated by strict schemas; unknown keys are rejected.
- Request bodies are capped at 32 KiB in the API and CLI.
- Generated paths are validated component by component: no absolute paths, no
  drive letters, no backslashes, no `.`/`..` segments, no control characters, no
  Windows device names.
- ZIP entries are re-validated on read; encryption, data descriptors and
  compression methods other than STORE are rejected.
- Limits: 200 files, 8 MiB total, 2 MiB per file.
- No user-supplied scripts are executed. No remote templates exist.
- Templates contain no `.env`, tokens, keystores or `local.properties`.
- API errors expose codes, messages and field issues only; stack traces and
  absolute paths are never serialized.

## Independence of generated projects

The ZIP contains its own Gradle wrapper (with `distributionSha256Sum`), version
catalog, `mise.toml`, `justfile` and scripts. It has no runtime dependency on the
Initializr server or this monorepo. `just android-smoke` proves this by extracting
a ZIP into `build/android-smoke` and running `assembleDebug` and
`testDebugUnitTest` there.
