---
name: generate-and-verify
description: Generate a Launchbed Android project with the CLI and verify it with mise, just, and repository checks.
---

# Generate and verify a project

## In this repository

```bash
just check
bun packages/cli/src/index.ts new --yes --name "Demo App" --app-id com.example.demo --preset compose-minimal --out /tmp/demo-app --force
```

Or `just cli-new`, which writes `build/example-app` and `build/example-app.zip`.

When JDK 21 and an Android SDK with `platforms/android-37.0` and Build Tools 36.0.0 are installed:

```bash
just android-smoke
```

Do not claim device tests passed unless `ANDROID_SERIAL=… just android-test` was actually run.

## In a generated project

```bash
cd <project>
mise install
just doctor
just test
just build
```

`just run` needs an authorized device or emulator. The Android SDK is installed with `just sdk-setup` (add `INSTALL=1` to install packages). mise does not install the Android SDK.

Device recipes (`just devices`, `run`, `logcat`, `screenshot`, `mirror`, `record`,
`deeplink`, …) validate `ANDROID_SERIAL` against `adb devices -l`. The optional
`tooling/scrcpy` addon pins `github:Genymobile/scrcpy@5.0.1` in `mise.toml`.
`just doctor` prints OS-specific install instructions when scrcpy is missing.

The optional `tooling/github-actions` addon (included in `compose-starter` and
`app-starter`) writes `.github/workflows/ci.yml` and `docs/CI.md`.
