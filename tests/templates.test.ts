import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, relative, sep } from "node:path";
import { FRAGMENT_FILES, TEMPLATE_FILES } from "@launchbed/generator";
import {
  canonicalText,
  expectedEol,
  formatDiskEolWarning,
  hasCanonicalEol,
  normalizeNewlines,
} from "../scripts/embed-templates";

const ROOT = join(import.meta.dir, "..");
const TEMPLATE_DIR = join(ROOT, "templates", "android-compose-minimal");
const FRAGMENTS_DIR = join(ROOT, "templates", "fragments");

function walkFragments(directory: string, base = directory): string[] {
  const found: string[] = [];
  for (const name of readdirSync(directory).sort()) {
    const absolute = join(directory, name);
    if (statSync(absolute).isDirectory()) found.push(...walkFragments(absolute, base));
    else found.push(relative(base, absolute).split(sep).join("/"));
  }
  return found.sort();
}

const BINARY = new Set([".jar", ".png"]);
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

function stripEol(text: string): string {
  return text.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
}

function describeTextDiff(path: string, embedded: string, disk: string): string {
  if (embedded === disk) return "";
  if (stripEol(embedded) === stripEol(disk)) {
    return `${path} differs only by line endings: disk=${eolKind(disk)} (${disk.length} bytes), embedded=${eolKind(embedded)} (${embedded.length} bytes)`;
  }
  return `${path} content differs (disk ${disk.length} bytes ${eolKind(disk)}, embedded ${embedded.length} bytes ${eolKind(embedded)})`;
}

function walk(directory: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(directory).sort()) {
    const absolute = join(directory, name);
    if (statSync(absolute).isDirectory()) {
      if (["build", ".gradle", ".kotlin", "node_modules"].includes(name)) continue;
      found.push(...walk(absolute));
    } else if (name !== "local.properties") {
      found.push(relative(TEMPLATE_DIR, absolute).split(sep).join("/"));
    }
  }
  return found.sort();
}

describe("embedded template bundle", () => {
  test("matches every file under templates/android-compose-minimal", () => {
    const diskPaths = walk(TEMPLATE_DIR);
    expect(Object.keys(TEMPLATE_FILES).sort()).toEqual(diskPaths);

    const mismatches: string[] = [];
    const eolProblems: string[] = [];
    for (const path of diskPaths) {
      const extension = extensionOf(path);
      const raw = readFileSync(join(TEMPLATE_DIR, path));
      const embedded = TEMPLATE_FILES[path]!;
      if (BINARY.has(extension)) {
        if (embedded.encoding !== "base64") mismatches.push(`${path} should be embedded as base64`);
        else if (!Buffer.from(embedded.content, "base64").equals(raw)) {
          mismatches.push(`${path} binary content differs (disk ${raw.length} bytes, embedded ${Buffer.from(embedded.content, "base64").length} bytes)`);
        }
        continue;
      }
      if (embedded.encoding !== "utf8") {
        mismatches.push(`${path} should be embedded as utf8`);
        continue;
      }
      const diskText = raw.toString("utf8");
      if (!hasCanonicalEol(path, embedded.content)) {
        eolProblems.push(`${path} is embedded with ${eolKind(embedded.content)} endings; generated files must use ${expectedEol(path)}`);
      }
      if (normalizeNewlines(embedded.content) !== normalizeNewlines(diskText)) {
        mismatches.push(describeTextDiff(path, embedded.content, diskText));
      }
    }
    expect({ mismatches, eolProblems }).toEqual({ mismatches: [], eolProblems: [] });
  });

  test("ships an authentic Gradle wrapper JAR", () => {
    const embedded = TEMPLATE_FILES["gradle/wrapper/gradle-wrapper.jar"];
    expect(embedded?.encoding).toBe("base64");
    const jar = Buffer.from(embedded!.content, "base64");
    // ZIP magic: the wrapper JAR is a real archive, not a placeholder.
    expect(jar.subarray(0, 2).toString()).toBe("PK");
    expect(jar.length).toBeGreaterThan(30_000);
  });

  test("keeps fragment bundle in sync", () => {
    const disk = walkFragments(FRAGMENTS_DIR)
      .filter((name) => !name.endsWith("README.md"))
      .sort();
    expect(Object.keys(FRAGMENT_FILES).sort()).toEqual(disk);
    const mismatches: string[] = [];
    for (const name of disk) {
      const diskText = readFileSync(join(FRAGMENTS_DIR, name), "utf8");
      const embedded = FRAGMENT_FILES[name]!;
      if (normalizeNewlines(embedded) !== normalizeNewlines(diskText)) {
        mismatches.push(describeTextDiff(name, embedded, diskText));
      }
    }
    expect(mismatches).toEqual([]);
  });
});

describe("template EOL policy", () => {
  test("compares normalized content and requires canonical endings only in the bundle", () => {
    const path = "scripts/doctor.ps1";
    const lf = "# hello\nWrite-Host ok\n";
    const crlf = canonicalText(path, lf);
    expect(crlf).toBe("# hello\r\nWrite-Host ok\r\n");
    expect(normalizeNewlines(crlf)).toBe(normalizeNewlines(lf));
    expect(hasCanonicalEol(path, crlf)).toBe(true);
    expect(hasCanonicalEol(path, lf)).toBe(false);
    expect(expectedEol(path)).toBe("CRLF");
    expect(expectedEol("justfile")).toBe("LF");
    expect(hasCanonicalEol("justfile", "foo\n")).toBe(true);
  });

  test("disk EOL drift is a warning with a renormalize hint, not a failure", () => {
    const message = formatDiskEolWarning([
      "templates/android-compose-minimal/scripts/doctor.ps1: disk=LF expected=CRLF",
    ]);
    expect(message).toContain("git add --renormalize .");
    expect(message).toContain("git checkout --");
    expect(message).toContain("not a failure");
    expect(message).toContain("doctor.ps1");
  });
});

describe("embed helper is read-only when imported", () => {
  test("importing scripts/embed-templates does not rewrite templates.generated.ts", () => {
    const generated = join(ROOT, "packages/generator/src/templates.generated.ts");
    const before = readFileSync(generated);
    const result = spawnSync(
      process.execPath,
      ["--eval", 'await import("./scripts/embed-templates.ts");'],
      { cwd: ROOT, encoding: "utf8" },
    );
    expect(result.status).toBe(0);
    expect(result.stdout ?? "").not.toContain("Embedded");
    expect(result.stderr ?? "").not.toContain("Embedded");
    const after = readFileSync(generated);
    expect(Buffer.from(after).equals(Buffer.from(before))).toBe(true);
  });
});
