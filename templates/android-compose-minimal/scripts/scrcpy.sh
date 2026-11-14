#!/usr/bin/env bash
# Optional device mirroring. scrcpy must be installed by the user.
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$script_dir/.."

if ! command -v scrcpy >/dev/null 2>&1; then
  printf 'scrcpy is not installed.\n' >&2
  printf 'Install it from your package manager or from https://github.com/Genymobile/scrcpy\n' >&2
  printf 'This project never downloads or redistributes scrcpy.\n' >&2
  exit 2
fi

if ! command -v adb >/dev/null 2>&1; then
  echo "adb is not available. Run: just sdk-setup" >&2
  exit 2
fi

serial="$(bash scripts/device.sh serial)"
exec scrcpy --serial "$serial" "$@"
