#!/usr/bin/env bash
# Cross-platform task dispatcher used by the justfile.
# On Windows it prefers the PowerShell implementation; elsewhere it runs bash.
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$script_dir/.."

task="${1:?usage: scripts/task.sh <task> [args...]}"
shift

case "$(uname -s 2>/dev/null || echo unknown)" in
  MINGW*|MSYS*|CYGWIN*)
    if [ -f "scripts/$task.ps1" ] && command -v powershell.exe >/dev/null 2>&1; then
      exec powershell.exe -NoProfile -ExecutionPolicy Bypass -File "scripts/$task.ps1" "$@"
    fi
    ;;
esac

if [ ! -f "scripts/$task.sh" ]; then
  echo "Unknown task: $task" >&2
  exit 2
fi
exec bash "scripts/$task.sh" "$@"
