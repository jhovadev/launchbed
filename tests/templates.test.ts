import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { FRAGMENT_FILES, TEMPLATE_FILES } from "@android-initializr/generator";

const ROOT = join(import.meta.dir, "..");
const TEMPLATE_DIR = join(ROOT, "templates", "android-compose-minimal");
const FRAGMENTS_DIR = join(ROOT, "templates", "fragments");

const BINARY = new Set([".jar", ".png"]);

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

    for (const path of diskPaths) {
      const extension = path.slice(path.lastIndexOf("."));
      const raw = readFileSync(join(TEMPLATE_DIR, path));
      const embedded = TEMPLATE_FILES[path]!;
      if (BINARY.has(extension)) {
        expect(embedded.encoding).toBe("base64");
        expect(Buffer.from(embedded.content, "base64").equals(raw)).toBe(true);
      } else {
        expect(embedded.encoding).toBe("utf8");
        expect(embedded.content).toBe(raw.toString("utf8"));
      }
    }
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
    const disk = readdirSync(FRAGMENTS_DIR)
      .filter((name) => !name.endsWith("README.md") && !name.startsWith("."))
      .sort();
    expect(Object.keys(FRAGMENT_FILES).sort()).toEqual(disk);
    for (const name of disk) {
      expect(FRAGMENT_FILES[name]).toBe(readFileSync(join(FRAGMENTS_DIR, name), "utf8"));
    }
  });
});
