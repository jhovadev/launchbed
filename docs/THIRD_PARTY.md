# Third-party material

## tweakcn theme presets

- **What:** the 42 theme presets in `packages/design-tokens/themes/*.json` (used by `--theme <id>`,
  the `themeId` request field and the web Theme step).
- **Source:** [jnsahaj/tweakcn](https://github.com/jnsahaj/tweakcn), file `utils/theme-presets.ts`
  (defaults from `config/theme.ts`), commit `a3b47b37cba97dd637de517aab52c45ec0f83456` (2026-09-03).
- **License:** Apache License 2.0. The full text is in [`docs/licenses/tweakcn-APACHE-2.0.txt`](licenses/tweakcn-APACHE-2.0.txt).
  The upstream repository has no NOTICE file.
- **Changes (Apache-2.0 §4b):** `scripts/import-tweakcn-themes.ts` converts each preset:
  - It applies tweakcn's own merge (defaults, then the preset; shared styles such as `radius` and
    `font-sans` come from light).
  - It maps the shadcn/ui CSS variables to Material 3 roles (see `TWEAKCN_ROLE_MAP` in
    `packages/design-tokens/src/tweakcn.ts`).
  - It converts oklch/hsl/rgb/hex to opaque sRGB hex, clamping out-of-gamut colors and compositing
    translucent ones over the background.
  - When a foreground role reaches less than 3:1 contrast on its background, it is replaced with
    black or white. The replaced roles are listed per theme in `$extensions["dev.launchbed"].contrastFixes`.
  - It reduces the font stack to a generic family (sans-serif, serif or monospace) and the radius
    to dp.
  - The original values Launchbed uses are kept in each file's `source.light` / `source.dark`.
- **Not included:** tweakcn's application code, fonts, shadows, chart and sidebar colors.

To refresh:

```sh
git clone https://github.com/jnsahaj/tweakcn /tmp/tweakcn
bun scripts/import-tweakcn-themes.ts --source /tmp/tweakcn          # rewrite the JSON
bun scripts/import-tweakcn-themes.ts --source /tmp/tweakcn --check  # verify committed JSON is current
```

The script stops if the upstream license is no longer Apache-2.0.
