import { LIMITS } from "./limits";

/** Java/Kotlin reserved words that must never be used as a package segment. */
const RESERVED_WORDS = new Set([
  "abstract", "assert", "boolean", "break", "byte", "case", "catch", "char", "class",
  "const", "continue", "default", "do", "double", "else", "enum", "extends", "final",
  "finally", "float", "for", "goto", "if", "implements", "import", "instanceof", "int",
  "interface", "long", "native", "new", "package", "private", "protected", "public",
  "return", "short", "static", "strictfp", "super", "switch", "synchronized", "this",
  "throw", "throws", "transient", "try", "void", "volatile", "while", "true", "false",
  "null", "fun", "val", "var", "when", "object", "typealias", "is", "in", "as", "by",
  "companion", "constructor", "data", "sealed", "inner", "open", "override", "lateinit",
  "suspend", "tailrec", "operator", "infix", "inline", "reified", "annotation", "crossinline",
  "noinline", "where", "init", "field", "property", "receiver", "param", "setparam", "delegate",
]);

/** Windows device names that cannot be used as file or directory names. */
const WINDOWS_RESERVED = new Set([
  "con", "prn", "aux", "nul",
  "com1", "com2", "com3", "com4", "com5", "com6", "com7", "com8", "com9",
  "lpt1", "lpt2", "lpt3", "lpt4", "lpt5", "lpt6", "lpt7", "lpt8", "lpt9",
]);

const PACKAGE_SEGMENT = /^[a-z][a-z0-9_]*$/;
const PROJECT_NAME = /^[A-Za-z][A-Za-z0-9 _.-]*$/;

export function validatePackageId(value: string): string[] {
  const problems: string[] = [];
  if (value.length === 0 || value.length > 150) {
    return ["must be between 1 and 150 characters"];
  }
  if (!value.includes(".")) {
    problems.push("must contain at least two segments, for example com.example.app");
  }
  const segments = value.split(".");
  for (const segment of segments) {
    if (segment.length === 0) {
      problems.push("must not contain empty segments");
    } else if (!PACKAGE_SEGMENT.test(segment)) {
      problems.push(`segment "${segment}" must match [a-z][a-z0-9_]*`);
    } else if (RESERVED_WORDS.has(segment)) {
      problems.push(`segment "${segment}" is a reserved Kotlin/Java keyword`);
    } else if (WINDOWS_RESERVED.has(segment)) {
      problems.push(`segment "${segment}" is reserved on Windows`);
    } else if (segment.length > 50) {
      problems.push(`segment "${segment}" is longer than 50 characters`);
    }
  }
  return problems;
}

export function validateProjectName(value: string): string[] {
  const problems: string[] = [];
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > LIMITS.projectNameLength) {
    problems.push(`must be between 1 and ${LIMITS.projectNameLength} characters`);
  }
  if (!PROJECT_NAME.test(trimmed)) {
    problems.push("must start with a letter and contain only letters, digits, spaces, dots, dashes or underscores");
  }
  if (trimmed !== value) {
    problems.push("must not start or end with whitespace");
  }
  if (trimmed.endsWith(".")) {
    problems.push("must not end with a dot");
  }
  return problems;
}

/** File name-safe project slug used for artifacts (ZIP name, root directory). */
export function projectSlug(projectName: string): string {
  return projectName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50) || "android-app";
}

export function packageToPath(packageName: string): string {
  return packageName.split(".").join("/");
}

/**
 * Validates a relative path that will be written to disk or into a ZIP.
 * Rejects absolute paths, traversal, control characters, Windows devices and
 * anything that would escape the project root.
 */
export function validateRelativePath(value: string, label = "path"): string[] {
  const problems: string[] = [];
  if (typeof value !== "string" || value.length === 0) {
    return [`${label} must not be empty`];
  }
  if (value.length > LIMITS.pathLength) {
    problems.push(`${label} exceeds ${LIMITS.pathLength} characters`);
  }
  if (value.startsWith("/") || value.startsWith("\\")) {
    problems.push(`${label} must be relative`);
  }
  if (/^[A-Za-z]:/.test(value)) {
    problems.push(`${label} must not contain a drive letter`);
  }
  if (value.includes("\\")) {
    problems.push(`${label} must use forward slashes`);
  }
  if (/[\u0000-\u001f\u007f]/.test(value)) {
    problems.push(`${label} must not contain control characters`);
  }
  if (value.includes("://") || value.startsWith("~")) {
    problems.push(`${label} must not be a URL or home-relative path`);
  }
  const segments = value.split("/");
  if (segments.length > LIMITS.pathDepth) {
    problems.push(`${label} exceeds ${LIMITS.pathDepth} path segments`);
  }
  for (const segment of segments) {
    if (segment === "" || segment === "." || segment === "..") {
      problems.push(`${label} must not contain empty, "." or ".." segments`);
      break;
    }
    if (segment.endsWith(" ") || segment.endsWith(".")) {
      problems.push(`${label} has a segment ending with a space or dot`);
      break;
    }
    if (WINDOWS_RESERVED.has(segment.split(".")[0]!.toLowerCase())) {
      problems.push(`${label} uses the reserved Windows name "${segment}"`);
      break;
    }
  }
  return problems;
}
