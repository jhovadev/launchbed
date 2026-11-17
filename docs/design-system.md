# Design system

`ThemeConfig` is the shared contract between the generator, Kotlin code
generation and the browser preview.

```json
{
  "seedColor": "#006C4C",
  "schemeVariant": "tonalSpot",
  "defaultMode": "system",
  "overrides": { "light": { "primary": "#005544" }, "dark": {} },
  "typography": { "fontFamily": "monospace" },
  "shape": { "cornerRadius": 12 },
  "spacing": { "xs": 4, "sm": 8, "md": 16, "lg": 24, "xl": 32 },
  "components": {
    "card": { "cornerRadius": 16, "elevation": 1 },
    "button": { "cornerRadius": 20, "minHeight": 48 }
  }
}
```

- `schemeVariant`: `tonalSpot`, `vibrant`, `expressive`, `neutral`, `monochrome`
  (implemented with Material Color Utilities).
- `overrides.light` / `overrides.dark`: optional hex overrides for the 29
  semantic roles (`primary`, `onPrimary`, `surface`, `outline`, `scrim`, ...).
- `typography.fontFamily`: `default`, `sansSerif`, `serif`, `monospace` — mapped
  to Compose `FontFamily` constants, no font assets required.
- `shape.cornerRadius` is the base dp value; extra-small to extra-large shapes
  derive from it.
- Component tokens are real values consumed by `HomeScreen.kt`, not decoration.

## Code generation

`resolveThemeTokens` returns light/dark semantic colors plus typography, shape,
spacing and component tokens. Those tokens are written as a W3C Design Tokens
(DTCG) document (`design-tokens.json`), which is the source of truth for the
generated project.

At **generator build time** — never inside the generated app — Style Dictionary
5.8.0 (`style-dictionary`, pinned in `bun.lock`) compiles that DTCG document.
The package `@launchbed/design-tokens/style-dictionary` owns this step;
`@launchbed/design-tokens` (the main entry) stays free of Style Dictionary so
the browser preview can keep importing tokens without bundling the compiler.

Built-in Style Dictionary formats are not used for Kotlin because they are not
byte-for-byte deterministic (timestamps, Prettier, file headers) and do not
match the existing Compose theme files. Launchbed registers custom formats
(`launchbed/compose-colors`, `launchbed/compose-tokens`,
`launchbed/css-variables`, `launchbed/flutter-dart`) with `showFileHeader:
false` and silent logging, then calls `formatAllPlatforms` in memory.

Outputs written into every generated project:

- `design-tokens.json` — DTCG source of truth.
- `ui/theme/GeneratedColors.kt` — 58 `Color(0xFF......)` constants.
- `ui/theme/GeneratedTokens.kt` — font family, base radius, `Spacing`,
  `ComponentTokens`.
- `tokens/tokens.css` — CSS custom properties. Written for every target;
  Android apps do not load this file. Expo and Flutter overlays include it.
- `tokens/tokens.ts` — TypeScript token object plus CSS-variable map for Expo
  (and other JS/TS targets).
- `tokens/tokens.dart` — Dart/Flutter constants. On Flutter projects this is
  written to `lib/tokens/tokens.dart` so the app can import it. Android apps
  do not load this file.

`generateComposeColors` / `generateComposeTokens` are thin wrappers around the
same custom formatters, so tests can assert Style Dictionary output equals the
helper. Repeating the compile with the same document yields identical bytes;
the GenerationPlan lists these files and the ZIP must match them.

`Theme.kt` (template source) builds `lightColorScheme`, `darkColorScheme`,
`Shapes` and `Typography` from the generated Kotlin values. The default
`AppTheme` mode follows `ThemeConfig.defaultMode`.

## Preview

`packages/preview` renders a SolidJS approximation of the generated screen using
the same resolved tokens. It is a **simulation**, not a Compose runtime: layout,
text metrics, elevation rendering and system bars are approximate. The UI labels
it as such. When Compose or Android tooling changes, the preview can lag without
affecting generated code.
