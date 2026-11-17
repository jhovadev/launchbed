import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { THEME_PRESETS, applyThemePreset, contrastRatio, cssColorToHex, findThemePreset, parseCssColor } from "@launchbed/design-tokens";
import { MIN_IMPORTED_CONTRAST, TWEAKCN_CONTRAST_PAIRS, fontFamilyFor, radiusToDp } from "../packages/design-tokens/src/tweakcn";
import { ThemeConfigSchema } from "@launchbed/schema";
import { getCatalog, materializeProject } from "@launchbed/generator";
import { themeDocument } from "../scripts/import-tweakcn-themes";
import { baseRequest } from "./fixtures";

const THEMES_DIR = join(import.meta.dir, "../packages/design-tokens/themes");
const files = readdirSync(THEMES_DIR).filter((name) => name.endsWith(".json")).sort();
const decode = (bytes: Uint8Array | undefined) => (bytes ? new TextDecoder().decode(bytes) : "");

describe("CSS color conversion", () => {
  test("oklch, hsl, rgb and hex convert to the expected sRGB hex", () => {
    expect(cssColorToHex("oklch(0.628 0.2577 29.23)")).toBe("#FF0000");
    expect(cssColorToHex("oklch(0.5198 0.1769 142.5)")).toBe("#008000");
    expect(cssColorToHex("oklch(1 0 0)")).toBe("#FFFFFF");
    expect(cssColorToHex("oklch(0 0 0)")).toBe("#000000");
    expect(cssColorToHex("oklch(0.577 0.245 27.325)")).toBe("#E7000B"); // Tailwind v4 red-600
    expect(cssColorToHex("oklch(62.8% 0.2577 29.23)")).toBe("#FF0000");
    expect(cssColorToHex("hsl(210 40% 96.1%)")).toBe("#F1F5F9"); // Tailwind slate-100
    expect(cssColorToHex("hsl(0, 100%, 50%)")).toBe("#FF0000");
    expect(cssColorToHex("rgb(59 130 246)")).toBe("#3B82F6");
    expect(cssColorToHex("#abc")).toBe("#AABBCC");
  });

  test("clamps out-of-gamut oklch and composites alpha over the backdrop", () => {
    const vivid = parseCssColor("oklch(0.9 0.4 150)");
    for (const channel of [vivid.r, vivid.g, vivid.b]) expect(channel).toBeGreaterThanOrEqual(0);
    for (const channel of [vivid.r, vivid.g, vivid.b]) expect(channel).toBeLessThanOrEqual(1);
    expect(cssColorToHex("oklch(0.9 0.4 150)")).toBe("#00FF00");
    expect(cssColorToHex("rgba(0, 0, 0, 0.5)")).toBe("#808080");
    expect(cssColorToHex("hsl(0 0% 0% / 0.5)", "#000000")).toBe("#000000");
    expect(() => parseCssColor("color-mix(in srgb, red, blue)")).toThrow();
  });

  test("radius and font mapping", () => {
    expect(radiusToDp("0.5rem")).toBe(8);
    expect(radiusToDp("0px")).toBe(0);
    expect(radiusToDp("6rem")).toBe(64);
    expect(fontFamilyFor("Inter, sans-serif")).toBe("sansSerif");
    expect(fontFamilyFor("Libre Baskerville, serif")).toBe("serif");
    expect(fontFamilyFor("Geist Mono, ui-monospace, monospace")).toBe("monospace");
  });
});

describe("imported tweakcn themes", () => {
  test("42 presets, unique ids, Apache-2.0 attribution, valid hex", () => {
    expect(files).toHaveLength(42);
    expect(THEME_PRESETS).toHaveLength(42);
    expect(new Set(THEME_PRESETS.map((preset) => preset.id)).size).toBe(42);
    for (const name of files) {
      const document = JSON.parse(readFileSync(join(THEMES_DIR, name), "utf8"));
      expect(`${document.id}.json`).toBe(name);
      expect(document.source.license).toBe("Apache-2.0");
      expect(document.source.repository).toBe("https://github.com/jnsahaj/tweakcn");
      expect(document.source.commit).toMatch(/^[0-9a-f]{40}$/);
      for (const mode of ["light", "dark"] as const) {
        for (const token of Object.values(document.color[mode]) as { $type: string; $value: string }[]) {
          expect(token.$type).toBe("color");
          expect(token.$value).toMatch(/^#[0-9A-F]{6}$/);
        }
      }
      expect(() => ThemeConfigSchema.parse(applyThemePreset(findThemePreset(document.id)!))).not.toThrow();
    }
  });

  test("contrast sanity: every foreground/background pair is at least 3:1", () => {
    for (const preset of THEME_PRESETS) {
      for (const mode of ["light", "dark"] as const) {
        const colors = preset[mode];
        for (const [foreground, background] of TWEAKCN_CONTRAST_PAIRS) {
          if (!colors[background] || !colors[foreground]) continue;
          const ratio = contrastRatio(colors[foreground]!, colors[background]!);
          if (ratio < MIN_IMPORTED_CONTRAST) throw new Error(`${preset.id} ${mode} ${foreground}/${background} = ${ratio.toFixed(2)}`);
        }
        expect(contrastRatio(colors.onBackground!, colors.background!)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  test("determinism: every file is reproduced byte for byte from its recorded source values", () => {
    for (const name of files) {
      const text = readFileSync(join(THEMES_DIR, name), "utf8");
      const document = JSON.parse(text);
      const again = themeDocument(document.id, document.label, document.source.light, document.source.dark, {
        commit: document.source.commit,
        license: document.source.license,
      });
      expect(again).toBe(text);
    }
  });

  test("applyThemePreset is idempotent and keeps explicit font/radius choices", () => {
    const preset = findThemePreset("catppuccin")!;
    const once = applyThemePreset(preset);
    expect(applyThemePreset(preset, once)).toEqual(once);
    const custom = applyThemePreset(preset, ThemeConfigSchema.parse({ shape: { cornerRadius: 20 } }));
    expect(custom.shape.cornerRadius).toBe(20);
    expect(custom.overrides.light.primary).toBe(preset.light.primary);
  });

  test("the catalog lists every theme with swatches", () => {
    const catalog = getCatalog();
    expect(catalog.themes).toHaveLength(42);
    expect(catalog.themes.every((theme) => theme.swatches.light.length === 5 && theme.license === "Apache-2.0")).toBe(true);
  });
});

describe("themeId flows to every target", () => {
  const preset = findThemePreset("catppuccin")!;
  const primary = preset.light.primary!;

  test("Compose, Expo and Flutter tokens carry the preset primary", async () => {
    const compose = await materializeProject(baseRequest({ themeId: "catppuccin" }));
    expect(compose.plan.request.themeId).toBe("catppuccin");
    expect(decode(compose.files.get("tokens/tokens.css"))).toContain(`--color-light-primary: ${primary};`);
    const kotlin = [...compose.files].filter(([path]) => path.endsWith("GeneratedColors.kt")).map(([, bytes]) => decode(bytes)).join("\n");
    expect(kotlin.toUpperCase()).toContain(primary.slice(1).toUpperCase());
    const expo = await materializeProject(baseRequest({ target: "expo", themeId: "catppuccin" }));
    expect(decode(expo.files.get("tokens/tokens.ts"))).toContain(`colorLightPrimary: "${primary}"`);
    const flutter = await materializeProject(baseRequest({ target: "flutter", themeId: "catppuccin" }));
    expect(decode(flutter.files.get("lib/tokens/tokens.dart")).toUpperCase()).toContain(primary.slice(1).toUpperCase());
  });

  test("unknown theme ids are rejected with a stable code", async () => {
    await expect(materializeProject(baseRequest({ themeId: "not-a-theme" }))).rejects.toMatchObject({ code: "INVALID_REQUEST" });
  });
});
