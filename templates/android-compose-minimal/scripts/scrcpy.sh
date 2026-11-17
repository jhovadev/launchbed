#!/usr/bin/env bash
# Optional device mirroring and recording. scrcpy must be installed by the user
# or pinned via the tooling/scrcpy addon (mise github:Genymobile/scrcpy).
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$script_dir/.."

print_scrcpy_install() {
  cat >&2 <<'EOF'
scrcpy is not installed.
Install a current build (distribution packages are often obsolete):
  mise use -g github:Genymobile/scrcpy@5.0.1
  # or add the Launchbed addon tooling/scrcpy, then: mise install
  Linux:  official tarball from https://github.com/Genymobile/scrcpy/releases
  macOS:  brew install scrcpy
  Windows: winget install Genymobile.scrcpy   (or the official zip)
Docs: https://github.com/Genymobile/scrcpy
This project never downloads or redistributes scrcpy at generate time.
EOF
}

is_safe_relpath() {
  local path="$1"
  [ -n "$path" ] || return 1
  case "$path" in
    /*|~*|*..*) return 1 ;;
  esac
  [[ "$path" =~ ^[A-Za-z0-9._/-]+$ ]]
}

if ! command -v adb >/dev/null 2>&1; then
  echo "adb is not available. Run: just sdk-setup" >&2
  exit 2
fi

action="${1:-mirror}"
if [ "$#" -gt 0 ]; then shift; fi
case "$action" in
  -*) set -- "$action" "$@"; action="mirror" ;;
esac

serial="$(bash scripts/device.sh serial)"

need_scrcpy() {
  if ! command -v scrcpy >/dev/null 2>&1; then
    print_scrcpy_install
    exit 2
  fi
}

case "$action" in
  mirror)
    need_scrcpy
    exec scrcpy --serial "$serial" --stay-awake "$@"
    ;;
  mirror-wifi)
    need_scrcpy
    # Official --tcpip configures adb tcpip from a USB (or already-TCP) device.
    exec scrcpy --serial "$serial" --tcpip --stay-awake "$@"
    ;;
  record)
    file="${1:-capture.mp4}"
    if [ "$#" -gt 0 ]; then shift; fi
    if ! is_safe_relpath "$file"; then
      echo "Refusing record path '$file'. Use a relative path with letters, digits, '.', '_', '-' or '/' only." >&2
      exit 2
    fi
    need_scrcpy
    mkdir -p "$(dirname -- "$file")"
    exec scrcpy --serial "$serial" --record="$file" --no-audio "$@"
    ;;
  *)
    echo "Usage: scripts/scrcpy.sh [mirror|mirror-wifi|record [file]]  (extra official scrcpy flags are forwarded)" >&2
    echo "Examples: just mirror -- --max-size 1024 --video-codec h264 --turn-screen-off" >&2
    exit 2
    ;;
esac
