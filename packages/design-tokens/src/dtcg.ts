import { SEMANTIC_COLOR_KEYS, type SemanticColorKey, type SemanticColors } from "@launchbed/schema";
import type { ThemeTokens } from "./index";

/** W3C Design Tokens Community Group token (https://design-tokens.github.io/community-group/format/). */
export interface DtcgToken {
  $type: "color" | "dimension" | "fontFamily" | "string";
  $value: string;
  $description?: string;
}

export interface DtcgDocument {
  $schema: string;
  $description: string;
  color: {
    seed: DtcgToken;
    light: Record<SemanticColorKey, DtcgToken>;
    dark: Record<SemanticColorKey, DtcgToken>;
  };
  dimension: {
    spacing: Record<"xs" | "sm" | "md" | "lg" | "xl", DtcgToken>;
    shape: { cornerRadius: DtcgToken };
    component: {
      card: { cornerRadius: DtcgToken; elevation: DtcgToken };
      button: { cornerRadius: DtcgToken; minHeight: DtcgToken };
    };
  };
  fontFamily: { plain: DtcgToken };
  meta: {
    schemeVariant: DtcgToken;
    defaultMode: DtcgToken;
  };
}

const SCHEMA = "https://tr.designtokens.org/format/";

function colorToken(value: string, description?: string): DtcgToken {
  const token: DtcgToken = { $type: "color", $value: value.toUpperCase() };
  if (description) token.$description = description;
  return token;
}

function dimensionToken(px: number, description?: string): DtcgToken {
  const token: DtcgToken = { $type: "dimension", $value: `${px}px` };
  if (description) token.$description = description;
  return token;
}

function schemeColors(scheme: SemanticColors): Record<SemanticColorKey, DtcgToken> {
  const group = {} as Record<SemanticColorKey, DtcgToken>;
  for (const key of SEMANTIC_COLOR_KEYS) {
    group[key] = colorToken(scheme[key]);
  }
  return group;
}

/** Deterministic DTCG document derived from resolved theme tokens. */
export function themeTokensToDtcg(tokens: ThemeTokens): DtcgDocument {
  return {
    $schema: SCHEMA,
    $description: "Launchbed theme tokens. Generated; do not edit by hand.",
    color: {
      seed: colorToken(tokens.seedColor, `Material 3 seed (${tokens.schemeVariant})`),
      light: schemeColors(tokens.light),
      dark: schemeColors(tokens.dark),
    },
    dimension: {
      spacing: {
        xs: dimensionToken(tokens.spacing.xs),
        sm: dimensionToken(tokens.spacing.sm),
        md: dimensionToken(tokens.spacing.md),
        lg: dimensionToken(tokens.spacing.lg),
        xl: dimensionToken(tokens.spacing.xl),
      },
      shape: { cornerRadius: dimensionToken(tokens.shape.cornerRadius) },
      component: {
        card: {
          cornerRadius: dimensionToken(tokens.components.card.cornerRadius),
          elevation: dimensionToken(tokens.components.card.elevation),
        },
        button: {
          cornerRadius: dimensionToken(tokens.components.button.cornerRadius),
          minHeight: dimensionToken(tokens.components.button.minHeight),
        },
      },
    },
    fontFamily: {
      plain: { $type: "fontFamily", $value: tokens.typography.fontFamily },
    },
    meta: {
      schemeVariant: { $type: "string", $value: tokens.schemeVariant },
      defaultMode: { $type: "string", $value: tokens.defaultMode },
    },
  };
}

export function serializeDtcg(document: DtcgDocument): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}

function parsePx(value: string, path: string): number {
  const match = /^(\d+(?:\.\d+)?)px$/.exec(value);
  if (!match) throw new Error(`DTCG token ${path} is not a px dimension: ${value}`);
  return Number(match[1]);
}

function parseScheme(group: Record<SemanticColorKey, DtcgToken>, path: string): SemanticColors {
  const colors = {} as SemanticColors;
  for (const key of SEMANTIC_COLOR_KEYS) {
    const token = group[key];
    if (!token || token.$type !== "color") {
      throw new Error(`DTCG token ${path}.${key} is missing or not a color`);
    }
    colors[key] = token.$value.toUpperCase();
  }
  return colors;
}

/** Inverse of themeTokensToDtcg. Used so Compose output is derived from the DTCG document. */
export function dtcgToThemeTokens(document: DtcgDocument): ThemeTokens {
  return {
    seedColor: document.color.seed.$value.toUpperCase(),
    schemeVariant: document.meta.schemeVariant.$value as ThemeTokens["schemeVariant"],
    defaultMode: document.meta.defaultMode.$value as ThemeTokens["defaultMode"],
    light: parseScheme(document.color.light, "color.light"),
    dark: parseScheme(document.color.dark, "color.dark"),
    typography: { fontFamily: document.fontFamily.plain.$value as ThemeTokens["typography"]["fontFamily"] },
    shape: { cornerRadius: parsePx(document.dimension.shape.cornerRadius.$value, "dimension.shape.cornerRadius") },
    spacing: {
      xs: parsePx(document.dimension.spacing.xs.$value, "dimension.spacing.xs"),
      sm: parsePx(document.dimension.spacing.sm.$value, "dimension.spacing.sm"),
      md: parsePx(document.dimension.spacing.md.$value, "dimension.spacing.md"),
      lg: parsePx(document.dimension.spacing.lg.$value, "dimension.spacing.lg"),
      xl: parsePx(document.dimension.spacing.xl.$value, "dimension.spacing.xl"),
    },
    components: {
      card: {
        cornerRadius: parsePx(document.dimension.component.card.cornerRadius.$value, "dimension.component.card.cornerRadius"),
        elevation: parsePx(document.dimension.component.card.elevation.$value, "dimension.component.card.elevation"),
      },
      button: {
        cornerRadius: parsePx(document.dimension.component.button.cornerRadius.$value, "dimension.component.button.cornerRadius"),
        minHeight: parsePx(document.dimension.component.button.minHeight.$value, "dimension.component.button.minHeight"),
      },
    },
  };
}
