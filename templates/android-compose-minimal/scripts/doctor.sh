#!/usr/bin/env bash
# Read-only environment diagnostics. Never installs or modifies anything.
set -uo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$script_dir/.."

status=0
ok() { printf '  [ok]      %s\n' "$*"; }
warn() { printf '  [warning] %s\n' "$*"; }
missing() { printf '  [missing] %s\n' "$*"; status=1; }

printf 'Android Initializr project doctor\n'
printf 'OS: %s\n\n' "$(uname -s 2>/dev/null || echo unknown)"

if command -v java >/dev/null 2>&1; then
  ok "java: $(java -version 2>&1 | head -n 1)"
else
  missing "java not found. Install JDK 21 (mise install) and retry."
fi

if [ -n "${JAVA_HOME:-}" ]; then
  ok "JAVA_HOME=$JAVA_HOME"
else
  warn "JAVA_HOME is not set; Gradle will use the java on PATH."
fi

sdk_root="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
if [ -z "$sdk_root" ]; then
  for candidate in "$HOME/Android/Sdk" "$HOME/Library/Android/sdk" "$HOME/Android/sdk"; do
    if [ -d "$candidate" ]; then sdk_root="$candidate"; break; fi
  done
fi

if [ -n "$sdk_root" ] && [ -d "$sdk_root" ]; then
  ok "Android SDK: $sdk_root"
  if [ -d "$sdk_root/platforms/android-{{compileSdkPackage}}" ]; then
    ok "platform android-{{compileSdkPackage}} installed"
  else
    missing "platform android-{{compileSdkPackage}} missing (just sdk-setup)"
  fi
  if [ -d "$sdk_root/build-tools/{{buildToolsVersion}}" ]; then
    ok "build-tools {{buildToolsVersion}} installed"
  else
    missing "build-tools {{buildToolsVersion}} missing (just sdk-setup)"
  fi
  if [ -f "$sdk_root/licenses/android-sdk-license" ]; then
    ok "Android SDK license accepted"
  else
    warn "Android SDK license not found; sdk-setup will explain how to accept it."
  fi
  if [ -x "$sdk_root/cmdline-tools/latest/bin/android" ] || [ -x "$sdk_root/cmdline-tools/latest/bin/sdkmanager" ]; then
    ok "Android command-line tools available"
  else
    warn "cmdline-tools not found under $sdk_root"
  fi
else
  missing "Android SDK not found. Set ANDROID_HOME or run just sdk-setup."
fi

if command -v adb >/dev/null 2>&1; then
  ok "adb: $(adb version 2>/dev/null | head -n 1)"
  device_count="$(adb devices 2>/dev/null | awk 'NR>1 && $2=="device"' | wc -l | tr -d ' ')"
  ok "authorized devices: $device_count"
else
  missing "adb not found. Install platform-tools (just sdk-setup)."
fi

if [ -x ./gradlew ]; then
  ok "Gradle wrapper present ({{gradleVersion}})"
else
  warn "./gradlew is not executable. Run: chmod +x gradlew"
fi

if command -v scrcpy >/dev/null 2>&1; then
  ok "scrcpy: $(scrcpy --version 2>/dev/null | head -n 1)"
else
  warn "scrcpy is not installed (optional; just scrcpy needs it)."
fi

printf '\n'
if [ "$status" -eq 0 ]; then
  printf 'Doctor result: ready to build.\n'
else
  printf 'Doctor result: missing required tools. Fix the [missing] entries above.\n'
fi
exit "$status"
