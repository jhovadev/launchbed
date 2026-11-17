/**
 * Style Dictionary 5 compilation for Launchbed design tokens.
 *
 * Runs at generator build time (never inside the generated Android app).
 * Custom formats are registered with Style Dictionary so Compose output stays
 * deterministic and byte-identical to the existing Kotlin theme files. CSS
 * custom properties and Flutter/Dart constants are also produced for future
 * targets.
 */
import StyleDictionary from "style-dictionary";
import type { DesignTokens, Dictionary, TransformedToken } from "style-dictionary/types";
import type { DtcgDocument } from "./dtcg";
import {
  formatComposeColors,
  formatComposeTokens,
  formatCssVariables,
  formatFlutterDart,
  formatTsCssInJs,
  themeTokensFromValueMap,
  type TokenValue,
} from "./formats";

export const STYLE_DICTIONARY_VERSION = "5.8.0";

export interface CompiledDesignTokens {
  composeColors: string;
  composeTokens: string;
  css: string;
  flutter: string;
  ts: string;
}

function asTokenValue(token: TransformedToken): TokenValue {
  const value = token.$value ?? token.value;
  const type = String(token.$type ?? token.type ?? "string");
  if (value === undefined || value === null) {
    throw new Error(`Style Dictionary token ${token.path.join(".")} has no value.`);
  }
  return { path: token.path, type, value: String(value) };
}

function valuesFromDictionary(dictionary: Dictionary): Map<string, string> {
  const values = new Map<string, string>();
  for (const token of dictionary.allTokens) {
    const parsed = asTokenValue(token);
    values.set(parsed.path.join("."), parsed.value);
  }
  return values;
}

function tokensFromDictionary(dictionary: Dictionary): TokenValue[] {
  return dictionary.allTokens.map(asTokenValue);
}

function composeColorsFormat({ dictionary, options }: { dictionary: Dictionary; options: { packageName?: string } }): string {
  const packageName = options.packageName;
  if (!packageName) throw new Error("launchbed/compose-colors requires options.packageName");
  return formatComposeColors(themeTokensFromValueMap(valuesFromDictionary(dictionary)), packageName);
}

function composeTokensFormat({ dictionary, options }: { dictionary: Dictionary; options: { packageName?: string } }): string {
  const packageName = options.packageName;
  if (!packageName) throw new Error("launchbed/compose-tokens requires options.packageName");
  return formatComposeTokens(themeTokensFromValueMap(valuesFromDictionary(dictionary)), packageName);
}

function cssVariablesFormat({ dictionary }: { dictionary: Dictionary }): string {
  return formatCssVariables(tokensFromDictionary(dictionary));
}

function flutterDartFormat({ dictionary }: { dictionary: Dictionary }): string {
  return formatFlutterDart(tokensFromDictionary(dictionary));
}

function tsCssInJsFormat({ dictionary }: { dictionary: Dictionary }): string {
  return formatTsCssInJs(tokensFromDictionary(dictionary));
}

/** DTCG document minus non-token metadata that Style Dictionary should not parse. */
export function styleDictionaryTokens(document: DtcgDocument): DesignTokens {
  const { $schema: _schema, $description: _description, ...tokens } = document;
  return tokens as DesignTokens;
}

/**
 * Compile a DTCG document with Style Dictionary 5.
 * Formats are custom and fully deterministic (sorted, no timestamps, no Prettier).
 */
export async function compileDesignTokens(
  document: DtcgDocument,
  options: { packageName: string },
): Promise<CompiledDesignTokens> {
  const sd = new StyleDictionary({
    tokens: styleDictionaryTokens(document),
    usesDtcg: true,
    log: { verbosity: "silent", warnings: "disabled" },
    hooks: {
      formats: {
        "launchbed/compose-colors": composeColorsFormat,
        "launchbed/compose-tokens": composeTokensFormat,
        "launchbed/css-variables": cssVariablesFormat,
        "launchbed/flutter-dart": flutterDartFormat,
        "launchbed/ts-css-in-js": tsCssInJsFormat,
      },
    },
    platforms: {
      compose: {
        options: { showFileHeader: false, packageName: options.packageName },
        files: [
          { destination: "GeneratedColors.kt", format: "launchbed/compose-colors" },
          { destination: "GeneratedTokens.kt", format: "launchbed/compose-tokens" },
        ],
      },
      css: {
        options: { showFileHeader: false },
        files: [{ destination: "tokens.css", format: "launchbed/css-variables" }],
      },
      flutter: {
        options: { showFileHeader: false },
        files: [{ destination: "tokens.dart", format: "launchbed/flutter-dart" }],
      },
      ts: {
        options: { showFileHeader: false },
        files: [{ destination: "tokens.ts", format: "launchbed/ts-css-in-js" }],
      },
    },
  });
  await sd.hasInitialized;
  const outputs = (await sd.formatAllPlatforms({ cache: false })) as Record<
    string,
    { destination?: string; output?: string }[]
  >;
  const read = (platform: string, destination: string): string => {
    const files = outputs[platform] ?? [];
    const file = files.find((entry) => entry.destination === destination);
    if (!file || typeof file.output !== "string") {
      throw new Error(`Style Dictionary did not emit ${platform}/${destination}`);
    }
    return file.output;
  };
  return {
    composeColors: read("compose", "GeneratedColors.kt"),
    composeTokens: read("compose", "GeneratedTokens.kt"),
    css: read("css", "tokens.css"),
    flutter: read("flutter", "tokens.dart"),
    ts: read("ts", "tokens.ts"),
  };
}
