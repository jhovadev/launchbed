#!/usr/bin/env bash
# Inspects the Android SDK before installing anything.
# Default mode is a dry run. Pass --install to install packages and --yes to
# accept SDK licenses non-interactively.
set -euo pipefail

install=0
accept_licenses=0
for arg in "$@"; do
  case "$arg" in
    --install) install=1 ;;
    --yes) accept_licenses=1 ;;
    -h|--help)
      cat <<'USAGE'
Usage: scripts/sdk-setup.sh [--install] [--yes]

  --install   Install missing SDK packages (default: print the plan only)
  --yes       Accept Android SDK licenses without prompting (use --install to act)
USAGE
      exit 0
      ;;
    *) echo "Unknown argument: $arg" >&2; exit 2 ;;
  esac
done
if [ "${INSTALL:-0}" = "1" ]; then install=1; fi

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$script_dir/.."

sdk_root="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
if [ -z "$sdk_root" ]; then
  case "$(uname -s 2>/dev/null || echo unknown)" in
    Darwin) sdk_root="$HOME/Library/Android/sdk" ;;
    *) sdk_root="$HOME/Android/Sdk" ;;
  esac
fi

platform_package="{{compileSdkPackage}}"
build_tools="{{buildToolsVersion}}"

printf 'Android SDK setup\n'
printf '  SDK root: %s\n' "$sdk_root"
printf '  Platform: android-%s\n' "$platform_package"
printf '  Build tools: %s\n\n' "$build_tools"

android_cli="$sdk_root/cmdline-tools/latest/bin/android"
sdkmanager="$sdk_root/cmdline-tools/latest/bin/sdkmanager"
if [ -x "$android_cli" ]; then
  cli_kind="android"
elif [ -x "$sdkmanager" ]; then
  cli_kind="sdkmanager"
else
  cli_kind="none"
fi

missing=()
if [ -d "$sdk_root/platform-tools" ]; then
  printf '  [installed] platform-tools\n'
else
  printf '  [missing]   platform-tools\n'
  missing+=("platform-tools")
fi
if [ -d "$sdk_root/platforms/android-$platform_package" ]; then
  printf '  [installed] platforms/android-%s\n' "$platform_package"
else
  printf '  [missing]   platforms/android-%s\n' "$platform_package"
  missing+=("platforms/android-$platform_package")
fi
if [ -d "$sdk_root/build-tools/$build_tools" ]; then
  printf '  [installed] build-tools/%s\n' "$build_tools"
else
  printf '  [missing]   build-tools/%s\n' "$build_tools"
  missing+=("build-tools/$build_tools")
fi

if [ -f "$sdk_root/licenses/android-sdk-license" ]; then
  printf '  [ok]        Android SDK license accepted\n'
else
  printf '  [attention] Android SDK license not accepted\n'
fi

if [ "$cli_kind" = "none" ]; then
  printf '\nAndroid command-line tools are not installed.\n'
  printf 'Download the official "Command-line tools only" package from:\n'
  printf '  https://developer.android.com/studio#command-tools\n'
  printf 'Unzip it so that this file exists:\n'
  printf '  %s/cmdline-tools/latest/bin/sdkmanager\n' "$sdk_root"
  printf 'Then rerun this script.\n'
  exit 2
fi

if [ "${#missing[@]}" -eq 0 ]; then
  printf '\nAll required SDK packages are installed.\n'
else
  printf '\nInstall plan (nothing has been changed yet):\n'
  for package in "${missing[@]}"; do printf '  - %s\n' "$package"; done

  if [ "$install" -ne 1 ]; then
    printf '\nDry run only. To install:\n  scripts/sdk-setup.sh --install\n\n'
    printf 'If Gradle reports unaccepted licenses, run once:\n  %s --licenses\n' "$sdkmanager"
    exit 0
  fi

  mkdir -p "$sdk_root"
  if [ "$cli_kind" = "android" ]; then
    if [ "$accept_licenses" -eq 1 ]; then
      printf '\nNote: the Android CLI manages licenses itself. Continuing.\n'
    fi
    for package in "${missing[@]}"; do
      "$android_cli" sdk install "$package"
    done
  else
    if [ "$accept_licenses" -eq 1 ]; then
      printf '\nAccepting Android SDK licenses...\n'
      yes | "$sdkmanager" --licenses >/dev/null
    fi
    semicolon_packages=()
    for package in "${missing[@]}"; do
      semicolon_packages+=("${package//\//;}")
    done
    "$sdkmanager" --install "${semicolon_packages[@]}"
  fi
fi

if [ "$install" -eq 1 ]; then
  printf 'sdk.dir=%s\n' "$sdk_root" > local.properties
  printf '\nWrote local.properties (git-ignored) and finished SDK setup.\n'
else
  printf '\nDry run complete; nothing was changed and local.properties was not written.\n'
fi
