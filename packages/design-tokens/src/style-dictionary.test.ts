import { describe, expect, test } from "bun:test";
import { ThemeConfigSchema } from "@launchbed/schema";
import {
  generateComposeColors,
  generateComposeTokens,
  resolveThemeTokens,
  themeTokensToDtcg,
  serializeDtcg,
} from "./index";
import { compileDesignTokens, STYLE_DICTIONARY_VERSION } from "./style-dictionary";

const theme = ThemeConfigSchema.parse({
  seedColor: "#6750A4",
  schemeVariant: "tonalSpot",
  defaultMode: "system",
  typography: { fontFamily: "sansSerif" },
  shape: { cornerRadius: 12 },
});

describe("Style Dictionary compilation", () => {
  test("pins Style Dictionary 5.8.0", () => {
    expect(STYLE_DICTIONARY_VERSION).toBe("5.8.0");
  });

  test("Compose output matches the ThemeTokens helper and is deterministic", async () => {
    const tokens = resolveThemeTokens(theme);
    const document = themeTokensToDtcg(tokens);
    const first = await compileDesignTokens(document, { packageName: "com.example.demo" });
    const second = await compileDesignTokens(document, { packageName: "com.example.demo" });
    expect(first.composeColors).toBe(generateComposeColors(tokens, "com.example.demo"));
    expect(first.composeTokens).toBe(generateComposeTokens(tokens, "com.example.demo"));
    expect(first.composeColors).toBe(second.composeColors);
    expect(first.composeTokens).toBe(second.composeTokens);
    expect(first.css).toBe(second.css);
    expect(first.flutter).toBe(second.flutter);
    expect(first.composeColors).toContain("Color(0xFF");
    expect(first.composeColors).toContain("via Style Dictionary 5");
    expect(first.composeTokens).toContain("internal object Spacing");
  });

  test("emits prepared CSS custom properties and Flutter/Dart constants", async () => {
    const document = themeTokensToDtcg(resolveThemeTokens(theme));
    const compiled = await compileDesignTokens(document, { packageName: "com.example.demo" });
    expect(compiled.css).toContain(":root {");
    expect(compiled.css).toMatch(/--color-light-primary: #[0-9A-F]{6};/);
    expect(compiled.css).toContain("--dimension-spacing-md: 16px;");
    expect(compiled.css).toContain("--font-family-plain: sansSerif;");
    expect(compiled.css).toContain("--meta-scheme-variant: tonalSpot;");
    expect(compiled.flutter).toContain("class LaunchbedTokens");
    expect(compiled.flutter).toMatch(/static const Color colorLightPrimary = Color\(0xFF[0-9A-F]{6}\);/);
    expect(compiled.flutter).toContain("static const double dimensionSpacingMd = 16.0;");
    expect(compiled.flutter).toContain('static const String fontFamilyPlain = "sansSerif";');
    // Sorted, no timestamps.
    expect(compiled.css.indexOf("--color-dark-primary")).toBeLessThan(compiled.css.indexOf("--color-light-primary"));
    expect(compiled.css).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(compiled.flutter).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  test("JSON serialization of the DTCG source stays stable across compiles", async () => {
    const document = themeTokensToDtcg(resolveThemeTokens(theme));
    const a = await compileDesignTokens(JSON.parse(serializeDtcg(document)), { packageName: "com.example.demo" });
    const b = await compileDesignTokens(JSON.parse(serializeDtcg(document)), { packageName: "com.example.demo" });
    expect(a).toEqual(b);
  });
});
