/**
 * Mapping from tweakcn (shadcn/ui CSS variables) presets to Launchbed theme data.
 * Source: https://github.com/jnsahaj/tweakcn (Apache-2.0); see docs/THIRD_PARTY.md.
 * Pure and deterministic: the same CSS variables always produce the same JSON.
 */
import type { SemanticColorKey } from "@launchbed/schema";
import { contrastRatio, cssColorToHex } from "./css-color";

export type CssVars = Readonly<Record<string, string>>;

/** shadcn variable → Material role. Roles not listed are derived from the seed (light primary). */
export const TWEAKCN_ROLE_MAP: readonly (readonly [SemanticColorKey, string])[] = [
  ["primary", "primary"],
  ["onPrimary", "primary-foreground"],
  ["secondary", "secondary"],
  ["onSecondary", "secondary-foreground"],
  ["secondaryContainer", "accent"],
  ["onSecondaryContainer", "accent-foreground"],
  ["background", "background"],
  ["onBackground", "foreground"],
  ["surface", "card"],
  ["onSurface", "card-foreground"],
  ["surfaceVariant", "muted"],
  ["onSurfaceVariant", "muted-foreground"],
  ["outlineVariant", "border"],
  ["error", "destructive"],
  ["onError", "destructive-foreground"],
  ["inverseSurface", "foreground"],
  ["inverseOnSurface", "background"],
  ["surfaceTint", "primary"],
];

/** Foreground/background pairs that must stay legible; below 3:1 the importer picks black or white. */
export const TWEAKCN_CONTRAST_PAIRS: readonly (readonly [SemanticColorKey, SemanticColorKey])[] = [
  ["onPrimary", "primary"],
  ["onSecondary", "secondary"],
  ["onSecondaryContainer", "secondaryContainer"],
  ["onBackground", "background"],
  ["onSurface", "surface"],
  ["onSurfaceVariant", "surfaceVariant"],
  ["onError", "error"],
];

export const MIN_IMPORTED_CONTRAST = 3;

export type ThemeFont = "default" | "sansSerif" | "serif" | "monospace";

export interface ImportedTheme {
  id: string;
  label: string;
  /** Light and dark Material roles as opaque sRGB hex. */
  light: Partial<Record<SemanticColorKey, string>>;
  dark: Partial<Record<SemanticColorKey, string>>;
  cornerRadius: number;
  fontFamily: ThemeFont;
  /** Original font stack, kept for reference (Launchbed maps it to a generic family). */
  fontSans: string;
  /** Roles whose foreground was replaced to reach MIN_IMPORTED_CONTRAST. */
  contrastFixes: string[];
}

/** "0.5rem" → 8, "6px" → 6, rounded to whole dp and clamped to the schema range (0..64). */
export function radiusToDp(radius: string | undefined): number {
  if (!radius) return 12;
  const value = Number.parseFloat(radius);
  if (!Number.isFinite(value)) return 12;
  const px = radius.trim().endsWith("rem") ? value * 16 : value;
  return Math.min(64, Math.max(0, Math.round(px)));
}

/** The first family of the stack decides the generic family Launchbed uses on every target. */
export function fontFamilyFor(stack: string | undefined): ThemeFont {
  if (!stack) return "default";
  const families = stack.toLowerCase().split(",").map((family) => family.trim().replace(/["']/g, ""));
  const first = families[0] ?? "";
  if (/mono|courier|code/.test(first)) return "monospace";
  if (/baskerville|merriweather|georgia|times|lora|playfair|serif$/.test(first) && !/sans/.test(first)) return "serif";
  return "sansSerif";
}

function readableOn(background: string): string {
  return contrastRatio("#000000", background) >= contrastRatio("#FFFFFF", background) ? "#000000" : "#FFFFFF";
}

function mapMode(vars: CssVars, fixes: string[], mode: "light" | "dark"): Partial<Record<SemanticColorKey, string>> {
  const background = vars.background ? cssColorToHex(vars.background) : mode === "light" ? "#FFFFFF" : "#000000";
  const roles: Partial<Record<SemanticColorKey, string>> = {};
  for (const [role, variable] of TWEAKCN_ROLE_MAP) {
    const source = vars[variable];
    if (source) roles[role] = cssColorToHex(source, background);
  }
  for (const [foreground, backgroundRole] of TWEAKCN_CONTRAST_PAIRS) {
    const bg = roles[backgroundRole];
    const fg = roles[foreground];
    if (!bg) continue;
    if (!fg || contrastRatio(fg, bg) < MIN_IMPORTED_CONTRAST) {
      roles[foreground] = readableOn(bg);
      fixes.push(`${mode}.${foreground}`);
    }
  }
  return roles;
}

/** Converts one preset (already merged with tweakcn defaults) to Launchbed theme data. */
export function convertTweakcnPreset(id: string, label: string, light: CssVars, dark: CssVars): ImportedTheme {
  const fixes: string[] = [];
  return {
    id,
    label,
    light: mapMode(light, fixes, "light"),
    dark: mapMode(dark, fixes, "dark"),
    cornerRadius: radiusToDp(light.radius),
    fontFamily: fontFamilyFor(light["font-sans"]),
    fontSans: light["font-sans"] ?? "",
    contrastFixes: fixes,
  };
}
