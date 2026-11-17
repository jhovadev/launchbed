import { describe, expect, test } from "bun:test";
import { ThemeConfigSchema } from "@launchbed/schema";
import {
  generateComposeColors,
  generateComposeTokens,
  resolveThemeTokens,
  themeTokensToDtcg,
  dtcgToThemeTokens,
  serializeDtcg,
} from "./index";

const theme = ThemeConfigSchema.parse({
  seedColor: "#6750A4",
  schemeVariant: "tonalSpot",
  defaultMode: "system",
  typography: { fontFamily: "sansSerif" },
  shape: { cornerRadius: 12 },
});

describe("DTCG theme tokens", () => {
  test("round-trips through a deterministic JSON document", () => {
    const tokens = resolveThemeTokens(theme);
    const document = themeTokensToDtcg(tokens);
    expect(document.$schema).toBe("https://tr.designtokens.org/format/");
    expect(document.color.seed.$type).toBe("color");
    expect(document.color.light.primary.$value).toMatch(/^#[0-9A-F]{6}$/);
    expect(document.dimension.spacing.md.$value).toBe("16px");
    expect(serializeDtcg(document)).toBe(serializeDtcg(JSON.parse(serializeDtcg(document))));
    expect(dtcgToThemeTokens(document)).toEqual(tokens);
  });

  test("Compose generators stay identical when driven from the DTCG document", () => {
    const tokens = resolveThemeTokens(theme);
    const fromDtcg = dtcgToThemeTokens(themeTokensToDtcg(tokens));
    expect(generateComposeColors(fromDtcg, "com.example.demo")).toBe(
      generateComposeColors(tokens, "com.example.demo"),
    );
    expect(generateComposeTokens(fromDtcg, "com.example.demo")).toBe(
      generateComposeTokens(tokens, "com.example.demo"),
    );
  });
});
