#!/usr/bin/env bash
# Device-aware helpers. Never assumes adb has exactly one device.
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$script_dir/.."

action="${1:-devices}"
if [ "$#" -gt 0 ]; then shift; fi

is_safe_relpath() {
  local path="$1"
  [ -n "$path" ] || return 1
  case "$path" in
    /*|~*|*..*) return 1 ;;
  esac
  [[ "$path" =~ ^[A-Za-z0-9._/-]+$ ]]
}

is_safe_uri() {
  local uri="$1"
  [ -n "$uri" ] || return 1
  case "$uri" in
    *$'\n'*|*$'\r'*|*';'*|*'|'*|*'`'*|*'$'*|*'*'*|*')'*) return 1 ;;
  esac
  [[ "$uri" =~ ^[A-Za-z][A-Za-z0-9+.-]*: ]]
}

select_serial() {
  if ! command -v adb >/dev/null 2>&1; then
    echo "adb not found. Run: just sdk-setup" >&2
    return 2
  fi

  local devices=() serial state _rest selected="${ANDROID_SERIAL:-}"
  local listing
  if ! listing="$(adb devices -l)"; then
    echo "adb devices failed." >&2
    return 2
  fi
  while read -r serial state _rest; do
    [ -n "$serial" ] || continue
    case "$state" in
      device) devices+=("$serial") ;;
      unauthorized|offline|recovery|sideload)
        if [ "$selected" = "$serial" ]; then
          echo "ANDROID_SERIAL=$serial is $state, not online and authorized." >&2
          return 2
        fi
        ;;
    esac
  done <<< "$listing"

  if [ -n "$selected" ]; then
    case "$selected" in *[!a-zA-Z0-9._:-]*|'')
      echo "Invalid ANDROID_SERIAL." >&2; return 2 ;; esac
    for serial in "${devices[@]}"; do
      if [ "$serial" = "$selected" ]; then printf '%s\n' "$serial"; return 0; fi
    done
    echo "ANDROID_SERIAL=$selected is not connected as an authorized online device." >&2
    return 2
  fi

  if [ "${#devices[@]}" -eq 0 ]; then
    echo "No authorized Android device found; check adb devices -l." >&2
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
  case "$choice" in ''|*[!0-9]*) echo "Invalid selection." >&2; return 3 ;; esac
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
  logs|logcat)
    serial="$(select_serial)"
    pid="$(adb -s "$serial" shell pidof -s "{{applicationId}}" | tr -d '\r')"
    if [ -z "$pid" ]; then
      echo "The app is not running on $serial. Start it with: just run" >&2
      exit 4
    fi
    printf 'Streaming logcat for %s (pid %s). Press Ctrl+C to stop.\n' "{{applicationId}}" "$pid" >&2
    exec adb -s "$serial" logcat -v brief --pid "$pid"
    ;;
  screenshot)
    file="${1:-screenshot.png}"
    if ! is_safe_relpath "$file"; then
      echo "Refusing screenshot path '$file'. Use a relative path with letters, digits, '.', '_', '-' or '/' only." >&2
      exit 2
    fi
    serial="$(select_serial)"
    mkdir -p "$(dirname -- "$file")"
    adb -s "$serial" exec-out screencap -p > "$file"
    printf 'Wrote %s\n' "$file"
    ;;
  clear-data)
    serial="$(select_serial)"
    adb -s "$serial" shell pm clear "{{applicationId}}"
    ;;
  uninstall)
    serial="$(select_serial)"
    adb -s "$serial" uninstall "{{applicationId}}"
    ;;
  deeplink)
    uri="${1:-}"
    if ! is_safe_uri "$uri"; then
      echo "Refusing deeplink '$uri'. Pass a URI such as https://example.com/path or myapp://host." >&2
      exit 2
    fi
    serial="$(select_serial)"
    adb -s "$serial" shell am start -a android.intent.action.VIEW -d "$uri"
    ;;
  *)
    echo "Usage: scripts/device.sh [devices|serial|install|launch|run|logs|screenshot|clear-data|uninstall|deeplink]" >&2
    exit 2
    ;;
esac
