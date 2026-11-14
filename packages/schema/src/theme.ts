import { z } from "zod";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export const hexColor = z
  .string()
  .regex(HEX_COLOR, "must be a 6-digit hex color such as #6750A4");

export const SEMANTIC_COLOR_KEYS = [
  "primary",
  "onPrimary",
  "primaryContainer",
  "onPrimaryContainer",
  "secondary",
  "onSecondary",
  "secondaryContainer",
  "onSecondaryContainer",
  "tertiary",
  "onTertiary",
  "tertiaryContainer",
  "onTertiaryContainer",
  "error",
  "onError",
  "errorContainer",
  "onErrorContainer",
  "background",
  "onBackground",
  "surface",
  "onSurface",
  "surfaceVariant",
  "onSurfaceVariant",
  "outline",
  "outlineVariant",
  "inverseSurface",
  "inverseOnSurface",
  "inversePrimary",
  "scrim",
  "surfaceTint",
] as const;

export type SemanticColorKey = (typeof SEMANTIC_COLOR_KEYS)[number];

export const SemanticColorsSchema = z.strictObject(
  Object.fromEntries(SEMANTIC_COLOR_KEYS.map((key) => [key, hexColor])) as Record<
    SemanticColorKey,
    typeof hexColor
  >,
);

export type SemanticColors = z.infer<typeof SemanticColorsSchema>;

export const SEMANTIC_OVERRIDES = SEMANTIC_COLOR_KEYS.reduce(
  (acc, key) => {
    acc[key] = hexColor.optional();
    return acc;
  },
  {} as Record<SemanticColorKey, z.ZodOptional<typeof hexColor>>,
);

export const SemanticColorOverridesSchema = z.strictObject(SEMANTIC_OVERRIDES);

export const SCHEME_VARIANTS = [
  "tonalSpot",
  "vibrant",
  "expressive",
  "neutral",
  "monochrome",
] as const;

export const THEME_FONT_FAMILIES = ["default", "sansSerif", "serif", "monospace"] as const;

export const ThemeConfigSchema = z
  .strictObject({
    seedColor: hexColor.default("#6750A4"),
    schemeVariant: z.enum(SCHEME_VARIANTS).default("tonalSpot"),
    defaultMode: z.enum(["system", "light", "dark"]).default("system"),
    overrides: z
      .strictObject({
        light: SemanticColorOverridesSchema.default({}),
        dark: SemanticColorOverridesSchema.default({}),
      })
      .default({ light: {}, dark: {} }),
    typography: z
      .strictObject({
        fontFamily: z.enum(THEME_FONT_FAMILIES).default("default"),
      })
      .default({ fontFamily: "default" }),
    shape: z
      .strictObject({
        /** Base corner radius in dp; other shape tokens are derived from it. */
        cornerRadius: z.number().int().min(0).max(64).default(12),
      })
      .default({ cornerRadius: 12 }),
    spacing: z
      .strictObject({
        xs: z.number().int().min(0).max(96).default(4),
        sm: z.number().int().min(0).max(96).default(8),
        md: z.number().int().min(0).max(96).default(16),
        lg: z.number().int().min(0).max(96).default(24),
        xl: z.number().int().min(0).max(96).default(32),
      })
      .default({ xs: 4, sm: 8, md: 16, lg: 24, xl: 32 }),
    components: z
      .strictObject({
        card: z
          .strictObject({
            cornerRadius: z.number().int().min(0).max(48).default(16),
            elevation: z.number().int().min(0).max(12).default(1),
          })
          .default({ cornerRadius: 16, elevation: 1 }),
        button: z
          .strictObject({
            cornerRadius: z.number().int().min(0).max(48).default(20),
            minHeight: z.number().int().min(40).max(72).default(48),
          })
          .default({ cornerRadius: 20, minHeight: 48 }),
      })
      .default({
        card: { cornerRadius: 16, elevation: 1 },
        button: { cornerRadius: 20, minHeight: 48 },
      }),
  })
  .default({
    seedColor: "#6750A4",
    schemeVariant: "tonalSpot",
    defaultMode: "system",
    overrides: { light: {}, dark: {} },
    typography: { fontFamily: "default" },
    shape: { cornerRadius: 12 },
    spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
    components: {
      card: { cornerRadius: 16, elevation: 1 },
      button: { cornerRadius: 20, minHeight: 48 },
    },
  });

export type ThemeConfig = z.infer<typeof ThemeConfigSchema>;
export type ThemeConfigInput = z.input<typeof ThemeConfigSchema>;
