/**
 * Theme presets imported from tweakcn (Apache-2.0, see docs/THIRD_PARTY.md). The JSON in
 * ../themes is committed data produced by scripts/import-tweakcn-themes.ts; nothing here
 * touches the network.
 */
import { SEMANTIC_COLOR_KEYS, ThemeConfigSchema, type SemanticColorKey, type ThemeConfig } from "@launchbed/schema";
import { TWEAKCN_THEME_FILES } from "../themes/index";
import type { ThemeFont } from "./tweakcn";

export interface ThemePreset {
  id: string;
  label: string;
  source: { repository: string; commit: string; license: string };
  /** Opaque sRGB hex per Material role, for the mapped roles only. */
  light: Partial<Record<SemanticColorKey, string>>;
  dark: Partial<Record<SemanticColorKey, string>>;
  cornerRadius: number;
  fontFamily: ThemeFont;
  fontStack: string;
}

interface ThemeFile {
  id: string;
  label: string;
  source: { repository: string; commit: string; license: string };
  color: { light: Record<string, { $value: string }>; dark: Record<string, { $value: string }> };
  dimension: { shape: { cornerRadius: { $value: string } } };
  fontFamily: { plain: { $value: string } };
  $extensions: { "dev.launchbed": { fontFamily: string } };
}

function roles(group: Record<string, { $value: string }>): Partial<Record<SemanticColorKey, string>> {
  const out: Partial<Record<SemanticColorKey, string>> = {};
  for (const key of SEMANTIC_COLOR_KEYS) if (group[key]) out[key] = group[key]!.$value;
  return out;
}

export const THEME_PRESETS: readonly ThemePreset[] = Object.freeze(
  (TWEAKCN_THEME_FILES as readonly ThemeFile[])
    .map((file) => ({
      id: file.id,
      label: file.label,
      source: { repository: file.source.repository, commit: file.source.commit, license: file.source.license },
      light: roles(file.color.light),
      dark: roles(file.color.dark),
      cornerRadius: Number.parseInt(file.dimension.shape.cornerRadius.$value, 10),
      fontFamily: file.$extensions["dev.launchbed"].fontFamily as ThemeFont,
      fontStack: file.fontFamily.plain.$value,
    }))
    .sort((a, b) => a.label.localeCompare(b.label)),
);

export const THEME_PRESET_IDS: readonly string[] = THEME_PRESETS.map((preset) => preset.id);

export function findThemePreset(id: string): ThemePreset | undefined {
  return THEME_PRESETS.find((preset) => preset.id === id);
}

const DEFAULT_THEME = ThemeConfigSchema.parse({});

/**
 * Applies a preset on top of a base theme. Colors always come from the preset (seed = light
 * primary, full overrides for the mapped roles). Font family and corner radius come from the
 * preset unless the base already changed them from the defaults (an explicit choice wins).
 * Mode, spacing and component sizes stay from the base. Idempotent.
 */
export function applyThemePreset(preset: ThemePreset, base: ThemeConfig = DEFAULT_THEME): ThemeConfig {
  return ThemeConfigSchema.parse({
    ...base,
    seedColor: preset.light.primary ?? base.seedColor,
    overrides: { light: { ...preset.light }, dark: { ...preset.dark } },
    typography:
      base.typography.fontFamily === DEFAULT_THEME.typography.fontFamily ? { fontFamily: preset.fontFamily } : base.typography,
    shape: base.shape.cornerRadius === DEFAULT_THEME.shape.cornerRadius ? { cornerRadius: preset.cornerRadius } : base.shape,
  });
}
