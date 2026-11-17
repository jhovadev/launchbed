import {
  Hct,
  SchemeExpressive,
  SchemeMonochrome,
  SchemeNeutral,
  SchemeTonalSpot,
  SchemeVibrant,
  argbFromHex,
  hexFromArgb,
} from "@material/material-color-utilities";
import { formatComposeColors, formatComposeTokens } from "./formats";
import {
  SEMANTIC_COLOR_KEYS,
  type SemanticColorKey,
  type SemanticColors,
  type ThemeConfig,
} from "@launchbed/schema";

export type SchemeVariant = ThemeConfig["schemeVariant"];

interface SchemeLike {
  primary: number;
  onPrimary: number;
  primaryContainer: number;
  onPrimaryContainer: number;
  secondary: number;
  onSecondary: number;
  secondaryContainer: number;
  onSecondaryContainer: number;
  tertiary: number;
  onTertiary: number;
  tertiaryContainer: number;
  onTertiaryContainer: number;
  error: number;
  onError: number;
  errorContainer: number;
  onErrorContainer: number;
  background: number;
  onBackground: number;
  surface: number;
  onSurface: number;
  surfaceVariant: number;
  onSurfaceVariant: number;
  outline: number;
  outlineVariant: number;
  inverseSurface: number;
  inverseOnSurface: number;
  inversePrimary: number;
  scrim: number;
  surfaceTint: number;
}

const VARIANTS = {
  tonalSpot: SchemeTonalSpot,
  vibrant: SchemeVibrant,
  expressive: SchemeExpressive,
  neutral: SchemeNeutral,
  monochrome: SchemeMonochrome,
} as const;

function buildScheme(seedColor: string, variant: SchemeVariant, dark: boolean): SemanticColors {
  const Scheme = VARIANTS[variant];
  const scheme = new Scheme(Hct.fromInt(argbFromHex(seedColor)), dark, 0) as unknown as SchemeLike;
  const colors = {} as SemanticColors;
  for (const key of SEMANTIC_COLOR_KEYS) {
    colors[key] = hexFromArgb(scheme[key]).toUpperCase();
  }
  return colors;
}

function applyOverrides(
  base: SemanticColors,
  overrides: Partial<Record<SemanticColorKey, string | undefined>> | undefined,
): SemanticColors {
  if (!overrides) return base;
  const result = { ...base };
  for (const key of SEMANTIC_COLOR_KEYS) {
    const value = overrides[key];
    if (value) result[key] = value.toUpperCase();
  }
  return result;
}

export interface ThemeTokens {
  seedColor: string;
  schemeVariant: SchemeVariant;
  defaultMode: ThemeConfig["defaultMode"];
  light: SemanticColors;
  dark: SemanticColors;
  typography: ThemeConfig["typography"];
  shape: ThemeConfig["shape"];
  spacing: ThemeConfig["spacing"];
  components: ThemeConfig["components"];
}

/**
 * Deterministic Material 3 token resolution. The same function feeds the
 * Compose code generator and the browser preview, so both stay in sync.
 */
export function resolveThemeTokens(theme: ThemeConfig): ThemeTokens {
  const light = applyOverrides(
    buildScheme(theme.seedColor, theme.schemeVariant, false),
    theme.overrides.light,
  );
  const dark = applyOverrides(
    buildScheme(theme.seedColor, theme.schemeVariant, true),
    theme.overrides.dark,
  );
  return {
    seedColor: theme.seedColor.toUpperCase(),
    schemeVariant: theme.schemeVariant,
    defaultMode: theme.defaultMode,
    light,
    dark,
    typography: theme.typography,
    shape: theme.shape,
    spacing: theme.spacing,
    components: theme.components,
  };
}

export { toKotlinColor } from "./formats";

/** Generates `ui/theme/GeneratedColors.kt`. Relative to the Kotlin source root. */
export function generateComposeColors(tokens: ThemeTokens, packageName: string): string {
  return formatComposeColors(tokens, packageName);
}

/** Generates `ui/theme/GeneratedTokens.kt` (spacing, shape and component tokens). */
export function generateComposeTokens(tokens: ThemeTokens, packageName: string): string {
  return formatComposeTokens(tokens, packageName);
}

export { themeTokensToDtcg, dtcgToThemeTokens, serializeDtcg, type DtcgDocument, type DtcgToken } from "./dtcg";
export { THEME_PRESETS, THEME_PRESET_IDS, applyThemePreset, findThemePreset, type ThemePreset } from "./theme-presets";
export { contrastRatio, cssColorToHex, parseCssColor } from "./css-color";
