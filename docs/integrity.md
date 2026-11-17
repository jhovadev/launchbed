# Integrity and release gates — F1.6C

F1.6C adds **source-level safety gates**, historical patch replay, and an evidence classifier. It **does not certify** a Play Store release or device performance. It does not introduce new presets, Android dependencies, native code or i18n.

## Quick commands

```sh
just integrity-parser-test
just integrity-check
just patch-replay
just release-check
```

- `integrity-check`: builds each of the four real generator presets twice, compares SHA-256, verifies plan/ZIP, safe paths, size limits, Gradle distribution checksum, missing accidental secrets, and the minimal preset's absence of optional Room/Navigation code. No SDK or network access is necessary. Saves `build/integrity/report.json`. **PASS** means these checks passed; it does **not** imply Android runs on a device.
- `patch-replay`: resolves `a316f53` from the local Git history; validates SHA-256 of seven in-repo patches and the three downloaded prior hotfix/performance patches, and applies them to an **isolated clone** in a temporary directory. It checks unchanged source file parity against the current tree, explicitly excluding F1.6C's own changes. Temporary clone is removed. It never changes the user's index, branches or working tree. Extract `F1.6A-runtime-verification.zip`, `F1.6A.1-astro-compose-hotfix.zip` and `F1.6B-performance-baseline.zip` to `~/Downloads` (or provide `--downloads <path>`). Missing external patches or missing Git base result in **BLOCKED** (exit 78); corruption or replay mismatch returns **FAIL**.
- `release-check`: runs the source gates plus reads `build/runtime-verification/report.json`, `build/performance/android.json`, `build/performance/generator.json`. It refuses PASS unless the three runtime presets have executed instrumentation marked PASS, and both benchmark reports cover all four presets. Reports FAIL for explicit failures, BLOCKED for missing evidence. Exit 78 = BLOCKED, 1 = FAIL. It does not rerun tests or trust timing thresholds. This is a **release-evidence check**, not a store-readiness certificate.

## Gates and honesty

| Area | What this phase checks | Remaining work |
|---|---|---|
| Generator | Real preset ZIPs, determinism and plan parity, path/file size and secret-path exclusions | API load tests; signed provenance |
| Gradle | Wrapper distribution checksum pin | Network provenance of downloaded artifacts, dependency vulnerability/SBOM audit |
| Android runtime | Classifies recorded instrumented tests, never upgrades NOT RUN to PASS | Execute on authorized emulator/device, test lifecycle/process death and UI |
| Native 16 KB | Source ZIP check plus optional F1.6D audit of **release APK** `.so` ZIP and ELF alignment | Confirm with official zipalign and 16 KB device/emulator runtime; inspect AAB separately |
| Release build | F1.6D enables R8 optimization and can build unsigned release APKs opt-in | Signing, full release runtime smoke, reproducibility and Play checks |
| Privacy | Refuses secret paths; template backup disabled with explicit cloud/device rules in F1.6D | OEM/cross-platform behavior, user data recovery/export, permissions/data safety |
| Licenses | Checks repository MIT text presence | Third-party dependency license inventory and notices |
| Performance | Classifies user benchmark reports; no timing threshold | Device macrobenchmarks, startup/frame time, Baseline Profiles |

F1.6D changes the **generated** release build to AGP 9.5's `optimization { enable = true }`, and chooses a conservative default backup policy with explicit cloud, device-transfer and legacy exclusions. This favors privacy but means uninstalling the local-notes app may lose the only copy of notes. Review the policy with your product and users before publishing.

`just release-audit` builds *unsigned release APKs* for all four presets, checks the optimized build and backup rules, inventories native `.so` inside each actual APK, and verifies ELF PT_LOAD and ZIP alignment when present. Its report is matched to the embedded-template SHA-256, so stale reports cannot satisfy the R8/native release gate. Without that report, `just release-check` remains BLOCKED. **Even with it, device instrumentation and signing/Play release readiness remain separate.**

The native inspector uses APK ZIP central-directory and ELF program headers. Confirm native APK findings with Android SDK `zipalign -v -c -P 16 4 <apk>` and the official Android 16 KB device images when native dependencies are present. Static checks never prove runtime compatibility.

The `build/performance/android/` **directory** holds extracted project builds; `build/performance/android.json` is the metrics report. No-change Gradle repeats are not incremental source rebuilds. The F1.6B timings are a baseline for the *same environment*, not hard CI thresholds.

## Why i18n remains out of scope

Internationalization scaffolding is deliberately deferred until the template architecture and Foundation contracts have settled. Standard `strings.xml` remains available; no locale plugin or translation workflow is introduced here.


## F1.6E: source-bound Android instrumentation evidence

The release gate reads `build/runtime-verification/device-report.json`, **not** the
compile-only `report.json`. A device run must be explicit; the harness does not
install apps during compile-only smoke tests. Device evidence uses schema v2,
contains a deterministic SHA-256 fingerprint of Android generator/manifest/template
and test-harness sources, and requires successful Gradle checks, both APK installs,
and a nonempty successful AndroidJUnitRunner result. An invalid, missing or stale
fingerprint remains BLOCKED; malformed kind/schema or duplicate preset evidence
fails closed. The fingerprint is a freshness check, **not a cryptographic
attestation** against intentional local tampering.

The device report stores a hash of the ADB serial rather than the serial itself.
Raw instrumentation logs remain under ignored `build/` directories. A newer
compile-only run updates only `report.json` and does not erase device evidence.
Running a new device test updates device evidence, including any new failures.

Use `just runtime-device-check` to check an authorized and booted Android device
with API >= 26, before `ANDROID_SERIAL=<real-device> just android-test`. This
preflight is read-only; the `android-test` command then installs isolated
`dev.launchbed.runtime.*` applications and runs the test APK. Do not use
personal devices with sensitive test data without checking test behavior first.

Device results should be validated on hardware/emulator. A PASS from the
instrumentation harness is not a complete Play Store certification: it does not
validate OEM backup behavior, signed release operation, long-run stability, or
real-world startup performance.
