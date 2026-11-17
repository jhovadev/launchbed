# Running Launchbed on a device

Launchbed never needs Android Studio. Install JDK 21 and Android SDK Command-Line Tools, Platform Tools and a matching platform/build-tools package. Bun is needed only for Launchbed generator, not for a downloaded Android app.

Use `just runtime-doctor` and `just runtime-devices` to inspect tools. A device marked `unauthorized` or `offline` cannot be selected. For two or more devices set `ANDROID_SERIAL` or supply `--serial` to the runtime harness. No first-device auto-selection is performed.

`just android-runtime-compile` generates independent Android projects under `build/runtime-verification/`, compiles and lints, runs JVM tests and compiles `androidTest` APKs. It never installs or runs tests on your phone. Runtime checks use `ANDROID_HOME`/`ANDROID_SDK_ROOT` (and standard SDK locations).

`ANDROID_SERIAL=<serial> just android-test` additionally installs both APKs on the exact selected device and executes the AndroidJUnitRunner. For privacy and safety, these demo test apps use temporary application IDs in the `dev.launchbed.runtime` namespace; tests can create test-only local databases on the selected device. `android-test` is an **explicit device modification** and should not be run against a phone with important unsaved app data.

Results are written to `build/runtime-verification/report.json` and individual `instrumentation-output.txt` files. For a PASS, inspect the tests-executed count and the `instrumented` gate. A downloaded template's `just run`, `just test`, and `just scrcpy` still work separately from this harness.

Known gaps: process-death navigation restore, end-to-end Notes editing, PowerShell runtime validation, emulator management across operating systems, and performance benchmarking. These are not treated as passed gates in F1.6A.
