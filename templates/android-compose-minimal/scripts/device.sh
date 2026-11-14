#!/usr/bin/env bash
# Device-aware helpers. Never assumes adb has exactly one device.
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$script_dir/.."

action="${1:-devices}"
if [ "$#" -gt 0 ]; then shift; fi

select_serial() {
  if [ -n "${ANDROID_SERIAL:-}" ]; then
    printf '%s\n' "$ANDROID_SERIAL"
    return 0
  fi

  local devices=()
  while IFS=$'\t' read -r serial state _rest; do
    if [ "$state" = "device" ]; then devices+=("$serial"); fi
  done < <(adb devices | tail -n +2)

  if [ "${#devices[@]}" -eq 0 ]; then
    echo "No authorized Android device found." >&2
    echo "Connect a device with USB debugging enabled, or start an emulator." >&2
    adb devices -l >&2
    return 2
  fi

  if [ "${#devices[@]}" -eq 1 ]; then
    printf '%s\n' "${devices[0]}"
    return 0
  fi

  printf 'Multiple devices detected:\n' >&2
  local index=1
  for serial in "${devices[@]}"; do
    printf '  %d) %s\n' "$index" "$serial" >&2
    index=$((index + 1))
  done
  printf 'Tip: set ANDROID_SERIAL to skip this prompt.\n' >&2

  if [ ! -t 0 ]; then
    echo "Cannot prompt in a non-interactive shell; set ANDROID_SERIAL." >&2
    return 3
  fi

  printf 'Select device [1-%d]: ' "${#devices[@]}" >&2
  read -r choice
  case "$choice" in
    ''|*[!0-9]*) echo "Invalid selection." >&2; return 3 ;;
  esac
  if [ "$choice" -lt 1 ] || [ "$choice" -gt "${#devices[@]}" ]; then
    echo "Invalid selection." >&2
    return 3
  fi
  printf '%s\n' "${devices[$((choice - 1))]}"
}

case "$action" in
  devices)
    adb devices -l
    ;;
  serial)
    select_serial
    ;;
  install)
    serial="$(select_serial)"
    ANDROID_SERIAL="$serial" ./gradlew :app:installDebug
    ;;
  launch)
    serial="$(select_serial)"
    adb -s "$serial" shell am start -n "{{applicationId}}/{{packageName}}.MainActivity"
    ;;
  run)
    ./gradlew :app:assembleDebug
    serial="$(select_serial)"
    ANDROID_SERIAL="$serial" ./gradlew :app:installDebug
    adb -s "$serial" shell am start -n "{{applicationId}}/{{packageName}}.MainActivity"
    ;;
  logs)
    serial="$(select_serial)"
    pid="$(adb -s "$serial" shell pidof -s "{{applicationId}}" | tr -d '\r')"
    if [ -z "$pid" ]; then
      echo "The app is not running on $serial. Start it with: just run" >&2
      exit 4
    fi
    printf 'Streaming logcat for %s (pid %s). Press Ctrl+C to stop.\n' "{{applicationId}}" "$pid" >&2
    exec adb -s "$serial" logcat -v brief --pid "$pid"
    ;;
  *)
    echo "Usage: scripts/device.sh [devices|serial|install|launch|run|logs]" >&2
    exit 2
    ;;
esac
