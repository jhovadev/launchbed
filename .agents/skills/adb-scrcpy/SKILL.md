---
name: adb-scrcpy
description: Use or extend generated adb and scrcpy just recipes (devices, mirror, record, screenshot, deeplink) and the tooling/scrcpy mise pin.
---

# adb and scrcpy in generated projects

## What already exists

- `scripts/device.sh` / `device.ps1` select a device with the same
  `ANDROID_SERIAL` rules as Launchbed's runtime tests: the serial must be an
  authorized online device from `adb devices -l`; a stale or invalid serial is
  rejected; several devices in a non-interactive shell require
  `ANDROID_SERIAL`.
- Base `just` recipes (do not redeclare these from an addon): `devices`,
  `install`, `launch`, `run`, `logs`, `logcat`, `screenshot`, `clear-data`,
  `uninstall`, `deeplink`, `scrcpy`, `mirror`, `mirror-wifi`, `record`.
- Addon `tooling/scrcpy` only pins `github:Genymobile/scrcpy = "5.0.1"` in
  `mise.toml`. The GitHub and aqua mise backends both resolve 5.0.1. The `ubi`
  backend is deprecated and must not be used.

## Commands

```bash
just devices
ANDROID_SERIAL=emulator-5554 just run
just logcat
just screenshot                    # or just screenshot file=captures/home.png
just record                        # scrcpy --record=capture.mp4 --no-audio
just mirror -- --max-size 1024 --turn-screen-off
just mirror-wifi                   # scrcpy --tcpip
just deeplink https://example.com
just clear-data
just uninstall
```

If `scrcpy` is missing, `just doctor` prints install instructions. Preferred:
`mise use -g github:Genymobile/scrcpy@5.0.1` or add `tooling/scrcpy` and run
`mise install`. Official flags only; see https://github.com/Genymobile/scrcpy.

## When changing this area

Keep path and URI arguments allow-listed (no `..`, no absolute paths, no shell
metacharacters). Update both bash and PowerShell. Add tests in
`tests/scripts.test.ts` and `tests/tooling-scrcpy.test.ts`. Run
`just templates-embed` after editing files under `templates/`.
