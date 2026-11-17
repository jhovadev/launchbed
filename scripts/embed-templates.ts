/**
 * Embeds templates/android-compose-minimal and templates/fragments into a
 * TypeScript module so the generator works identically in Bun, Node (Astro SSR)
 * and tests without runtime filesystem access to the repository.
 *
 * Usage:
 *   bun run scripts/embed-templates.ts           # write
 *   bun run scripts/embed-templates.ts --check   # verify (CI)
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TEMPLATE_DIR = join(ROOT, "templates", "android-compose-minimal");
const FRAGMENTS_DIR = join(ROOT, "templates", "fragments");
const OUT_FILE = join(ROOT, "packages", "generator", "src", "templates.generated.ts");

const SKIPPED_DIRECTORIES = new Set([
  ".git", ".gradle", ".kotlin", "build", "node_modules", "captures", ".cxx", ".externalNativeBuild",
]);
const SKIPPED_FILES = new Set(["local.properties", ".DS_Store"]);
const BINARY_EXTENSIONS = new Set([".jar", ".png", ".webp", ".jpg", ".jpeg", ".gif", ".ttf", ".otf", ".so", ".zip"]);
const CRLF_EXTENSIONS = new Set([".ps1", ".bat", ".cmd"]);

function extensionOf(path: string): string {
  const dot = path.lastIndexOf(".");
  return dot >= 0 ? path.slice(dot).toLowerCase() : "";
}

function eolKind(text: string): "CRLF" | "LF" | "CR" | "MIXED" | "NONE" {
  const crlf = (text.match(/\r\n/g) ?? []).length;
  const cr = (text.match(/\r/g) ?? []).length - crlf;
  const lf = (text.match(/\n/g) ?? []).length - crlf;
  if (crlf + cr + lf === 0) return "NONE";
  if (crlf > 0 && cr === 0 && lf === 0) return "CRLF";
  if (lf > 0 && crlf === 0 && cr === 0) return "LF";
  if (cr > 0 && crlf === 0 && lf === 0) return "CR";
  return "MIXED";
}

/** Canonical endings match .gitattributes: LF for text, CRLF for Windows entry points. */
export function canonicalText(path: string, text: string): string {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (CRLF_EXTENSIONS.has(extensionOf(path))) return normalized.replace(/\n/g, "\r\n");
  return normalized;
}

export function expectedEol(path: string): "CRLF" | "LF" {
  return CRLF_EXTENSIONS.has(extensionOf(path)) ? "CRLF" : "LF";
}

export function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function hasCanonicalEol(path: string, text: string): boolean {
  return text === canonicalText(path, text);
}

/** Human-readable hint when the worktree was checked out with the wrong endings. */
export const DISK_EOL_HINT =
  "Working-tree line endings are not canonical (see .gitattributes). The embedded bundle already stores canonical endings (CRLF for .ps1/.bat/.cmd, LF otherwise), so this is not a failure. To rewrite the worktree, run: git add --renormalize .  or  git checkout -- templates/android-compose-minimal/scripts/";

export function formatDiskEolWarning(problems: readonly string[]): string {
  return [DISK_EOL_HINT, ...problems.map((line) => `  ${line}`)].join("\n");
}

export function reportDiskEolWarnings(
  problems: readonly string[],
  log: (message: string) => void = console.warn,
): void {
  if (problems.length === 0) return;
  log(formatDiskEolWarning(problems));
}

function walk(directory: string, base = directory): string[] {
  const entries: string[] = [];
  for (const name of readdirSync(directory).sort()) {
    const absolute = join(directory, name);
    const stats = statSync(absolute);
    if (stats.isDirectory()) {
      if (SKIPPED_DIRECTORIES.has(name)) continue;
      entries.push(...walk(absolute, base));
    } else if (stats.isFile()) {
      if (SKIPPED_FILES.has(name)) continue;
      entries.push(relative(base, absolute).split(sep).join("/"));
    }
  }
  return entries.sort();
}

function encodeFile(relativePath: string, absolutePath: string): { encoding: "utf8" | "base64"; content: string; rewritten?: boolean } {
  const buffer = readFileSync(absolutePath);
  const extension = extensionOf(relativePath);
  if (BINARY_EXTENSIONS.has(extension)) {
    return { encoding: "base64", content: buffer.toString("base64") };
  }
  const raw = buffer.toString("utf8");
  if (raw.includes("\uFFFD")) {
    throw new Error(`Template file is not valid UTF-8 and has no binary extension: ${relativePath}`);
  }
  const content = canonicalText(relativePath, raw);
  return { encoding: "utf8", content, rewritten: content !== raw };
}

function buildModule(): string {
  const templatePaths = walk(TEMPLATE_DIR);
  const templateEntries = templatePaths.map((path) => {
    return [path, encodeFile(path, join(TEMPLATE_DIR, path))] as const;
  });

  let fragmentPaths: string[] = [];
  try {
    fragmentPaths = walk(FRAGMENTS_DIR);
  } catch {
    fragmentPaths = [];
  }
  const fragmentEntries = fragmentPaths
    .filter((path) => !path.endsWith("README.md"))
    .filter((path) => !path.split("/").some((segment) => segment.startsWith(".")))
    .map((path) => {
      const raw = readFileSync(join(FRAGMENTS_DIR, path), "utf8");
      return [path, canonicalText(path, raw), raw !== canonicalText(path, raw)] as const;
    });

  const lines: string[] = [
    "// Generated by scripts/embed-templates.ts. Do not edit by hand.",
    "// Source of truth: templates/android-compose-minimal and templates/fragments.",
    "",
    "export type EmbeddedFile =",
    '  | { encoding: "utf8"; content: string }',
    '  | { encoding: "base64"; content: string };',
    "",
    "export const TEMPLATE_ID = \"android-compose-minimal\";",
    "export const TEMPLATE_VERSION = \"0.1.0\";",
    "",
    "export const TEMPLATE_FILES: Readonly<Record<string, EmbeddedFile>> = {",
  ];

  for (const [path, file] of templateEntries) {
    lines.push(`  ${JSON.stringify(path)}: { encoding: "${file.encoding}", content: ${JSON.stringify(file.content)} },`);
  }
  lines.push("};", "", "export const FRAGMENT_FILES: Readonly<Record<string, string>> = {");
  for (const [path, content] of fragmentEntries) {
    lines.push(`  ${JSON.stringify(path)}: ${JSON.stringify(content)},`);
  }
  lines.push("};", "");
  return lines.join("\n");
}

export function listEolDrift(): string[] {
  const problems: string[] = [];
  for (const path of walk(TEMPLATE_DIR)) {
    if (BINARY_EXTENSIONS.has(extensionOf(path))) continue;
    const raw = readFileSync(join(TEMPLATE_DIR, path), "utf8");
    const canonical = canonicalText(path, raw);
    if (raw !== canonical) {
      problems.push(`templates/android-compose-minimal/${path}: disk=${eolKind(raw)} expected=${expectedEol(path)}`);
    }
  }
  try {
    for (const path of walk(FRAGMENTS_DIR)) {
      if (path.endsWith("README.md") || path.split("/").some((segment) => segment.startsWith("."))) continue;
      const raw = readFileSync(join(FRAGMENTS_DIR, path), "utf8");
      const canonical = canonicalText(path, raw);
      if (raw !== canonical) {
        problems.push(`templates/fragments/${path}: disk=${eolKind(raw)} expected=${expectedEol(path)}`);
      }
    }
  } catch {
    // fragments directory is optional
  }
  return problems;
}

function rewriteCanonicalSources(): number {
  let count = 0;
  for (const path of walk(TEMPLATE_DIR)) {
    if (BINARY_EXTENSIONS.has(extensionOf(path))) continue;
    const absolute = join(TEMPLATE_DIR, path);
    const raw = readFileSync(absolute, "utf8");
    const canonical = canonicalText(path, raw);
    if (raw !== canonical) {
      writeFileSync(absolute, canonical, "utf8");
      count++;
    }
  }
  try {
    for (const path of walk(FRAGMENTS_DIR)) {
      if (path.endsWith("README.md") || path.split("/").some((segment) => segment.startsWith("."))) continue;
      const absolute = join(FRAGMENTS_DIR, path);
      const raw = readFileSync(absolute, "utf8");
      const canonical = canonicalText(path, raw);
      if (raw !== canonical) {
        writeFileSync(absolute, canonical, "utf8");
        count++;
      }
    }
  } catch {
    // fragments directory is optional
  }
  return count;
}

const check = process.argv.includes("--check");

if (check) {
  // Disk EOL is advisory: git may leave stale LF .ps1 files in an already-checked-out tree.
  reportDiskEolWarnings(listEolDrift());
  const moduleSource = buildModule();
  let existing = "";
  try {
    existing = readFileSync(OUT_FILE, "utf8");
  } catch {
    existing = "";
  }
  if (existing !== moduleSource) {
    console.error("templates.generated.ts is out of date. Run: bun run templates:embed");
    process.exit(1);
  }
  console.log(`templates.generated.ts is up to date (${walk(TEMPLATE_DIR).length} files).`);
} else {
  const rewritten = rewriteCanonicalSources();
  const moduleSource = buildModule();
  writeFileSync(OUT_FILE, moduleSource, "utf8");
  const extra = rewritten > 0 ? ` Normalized ${rewritten} source file(s) to canonical line endings.` : "";
  console.log(`Embedded ${walk(TEMPLATE_DIR).length} template files into packages/generator/src/templates.generated.ts.${extra}`);
}
