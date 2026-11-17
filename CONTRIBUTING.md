# Contributing

## Setup

Read [AGENTS.md](AGENTS.md) for commands that actually exist and for the rules coding agents should follow.


```bash
mise install
bun install
just check
```

`just check` runs TypeScript typechecking, unit/security tests, the template
drift check and the Astro build. `just android-smoke` additionally needs JDK 21
and an Android SDK with `android-37.0` and Build Tools 36.0.0.

## Ground rules

- Preserve native-first for generated apps today: Kotlin + Jetpack Compose Material 3 for generated apps.
- Do not add a dependency without pinning an exact version and documenting it in
  `docs/compatibility.md`.
- Never add remote templates, arbitrary script execution, dynamic versions or
  secrets to templates.
- Do not claim a feature works unless a test or a real command proves it.
- Keep changes small and reviewable; prefer one concern per patch.

## Changing the Android template

1. Edit files under `templates/android-compose-minimal`.
2. Run `just templates-embed`.
3. Run `just check` (the drift test compares the bundle with disk).
4. Run `just android-smoke` when the change affects Gradle, Kotlin, resources or
   scripts.

## Commit messages

Conventional Commits, imperative subject, <= 72 characters:

```text
feat(generator): add deterministic zip permissions
fix(template): keep gradlew executable in generated zips
docs(adr): record native addon ABI decision
test(resolver): cover dependency cycles
```

No commit or push is performed by automation without explicit authorization.

## Adding an addon

Read `docs/addon-spec.md`. Start as `planned` with no file operations. Only move
to `stable`/`beta` when code generation, tests and documentation exist. Add
resolver tests for dependencies and conflicts.
