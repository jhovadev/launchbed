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
(DTCG) document, and the Kotlin files are derived from it:

- `design-tokens.json` — DTCG source of truth for the generated project.
- `ui/theme/GeneratedColors.kt` — 58 `Color(0xFF......)` constants.
- `ui/theme/GeneratedTokens.kt` — font family, base radius, `Spacing`,
  `ComponentTokens`.

`Theme.kt` (template source) builds `lightColorScheme`, `darkColorScheme`,
`Shapes` and `Typography` from those generated values. The default `AppTheme`
mode follows `ThemeConfig.defaultMode`.

## Preview

`packages/preview` renders a SolidJS approximation of the generated screen using
the same resolved tokens. It is a **simulation**, not a Compose runtime: layout,
text metrics, elevation rendering and system bars are approximate. The UI labels
it as such. When Compose or Android tooling changes, the preview can lag without
affecting generated code.
