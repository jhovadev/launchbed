import { LaunchbedError } from "@launchbed/schema";

export type TemplateVars = Record<string, string>;

const PLACEHOLDER = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;
/** `{{gha:github.workflow}}` becomes `${{ github.workflow }}`. */
const GHA_PLACEHOLDER = /\{\{\s*gha:([^}]+?)\s*\}\}/g;
const SAFE_GHA_EXPR = /^[A-Za-z0-9_().\s|'"`/*-]+$/;
const SAFE_GHA_OUTPUT = /\$\{\{\s*[A-Za-z0-9_().\s|'"`/*-]+\s*\}\}/g;

export function renderGhaExpression(expr: string, context: string): string {
  const trimmed = expr.trim();
  if (!SAFE_GHA_EXPR.test(trimmed) || /secrets/i.test(trimmed)) {
    throw new LaunchbedError(
      "TEMPLATE_ERROR",
      `Unsafe or unsupported GitHub Actions expression in ${context}: ${trimmed}.`,
    );
  }
  return `\${{ ${trimmed} }}`;
}

/**
 * Replaces `{{name}}` placeholders with validated values and `{{gha:expr}}` with
 * a safe `${{ expr }}` GitHub Actions interpolation. Unknown or leftover
 * placeholders are hard errors: templates must never ship unresolved tokens.
 */
export function renderText(source: string, vars: TemplateVars, context: string): string {
  const withGha = source.replace(GHA_PLACEHOLDER, (_match, expr: string) => renderGhaExpression(expr, context));
  const rendered = withGha.replace(PLACEHOLDER, (_match, key: string) => {
    const value = vars[key];
    if (value === undefined) {
      throw new LaunchbedError(
        "TEMPLATE_ERROR",
        `Unknown template variable "${key}" in ${context}.`,
      );
    }
    return value;
  });
  const leftover = rendered.replace(SAFE_GHA_OUTPUT, "");
  if (leftover.includes("{{")) {
    throw new LaunchbedError("TEMPLATE_ERROR", `Unresolved template placeholder in ${context}.`);
  }
  return rendered;
}
