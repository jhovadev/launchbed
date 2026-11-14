import { InitializrError } from "@android-initializr/schema";

export type TemplateVars = Record<string, string>;

const PLACEHOLDER = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

/**
 * Replaces `{{name}}` placeholders with validated values. Unknown or leftover
 * placeholders are hard errors: templates must never ship unresolved tokens.
 */
export function renderText(source: string, vars: TemplateVars, context: string): string {
  const rendered = source.replace(PLACEHOLDER, (_match, key: string) => {
    const value = vars[key];
    if (value === undefined) {
      throw new InitializrError(
        "TEMPLATE_ERROR",
        `Unknown template variable "${key}" in ${context}.`,
      );
    }
    return value;
  });
  if (rendered.includes("{{")) {
    throw new InitializrError("TEMPLATE_ERROR", `Unresolved template placeholder in ${context}.`);
  }
  return rendered;
}
