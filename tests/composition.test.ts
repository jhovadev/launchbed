import { describe, expect, test } from "bun:test";
import {
  applyComposition,
  generateProject,
  materializeProject,
  parseToml as parse,
  readZip,
} from "@android-initializr/generator";
import { InitializrError, type ErrorCode } from "@android-initializr/schema";
import { baseRequest, stableAddon } from "./fixtures";
import {
  allFixtureAddons,
  conflictingAddon,
  duplicateAddon,
  fixtureAddons,
  fixtureFragments,
  staleSlotAddon,
} from "./fixtures-addons";

const options = { addons: allFixtureAddons, fragments: fixtureFragments };

function read(zip: Uint8Array): Map<string, Uint8Array> {
  return new Map(readZip(zip).map((entry) => [entry.path, entry.data]));
}

function text(files: Map<string, Uint8Array>, path: string): string {
  return new TextDecoder().decode(files.get(path)!);
}

function expectCode(fn: () => unknown, code: ErrorCode): void {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(InitializrError);
    expect((error as InitializrError).code).toBe(code);
    return;
  }
  throw new Error("expected InitializrError");
}

describe("safe addon composition", () => {
  test("adds a Kotlin file with rendered path and content", () => {
    const request = baseRequest({ addons: ["ui/fixture-alpha"] });
    const project = materializeProject(request, options);
    const path = "app/src/main/java/com/example/demo/ui/FixtureAlpha.kt";
    expect(text(project.files, path)).toContain("package com.example.demo.ui");
    expect(text(project.files, path)).toContain('FIXTURE_SCREEN = "Demo App"');
    expect(project.plan.operations.some((op) => op.type === "add" && op.path === path)).toBe(true);
  });

  test("merges catalog aliases and Gradle dependencies", () => {
    const request = baseRequest({ addons: ["ui/fixture-alpha"] });
    const project = materializeProject(request, options);
    const catalog = parse(text(project.files, "gradle/libs.versions.toml")) as any;
    expect(catalog.versions["fixture-alpha"]).toBe("1.17.0");
    expect(catalog.libraries["fixture-alpha"]).toEqual({
      module: "androidx.core:core-ktx",
      version: { ref: "fixture-alpha" },
    });
    const build = text(project.files, "app/build.gradle.kts");
    expect(build).toContain("implementation(libs.fixture-alpha)");
    expect(build.split("implementation(libs.fixture-alpha)").length - 1).toBe(1);
  });

  test("two addons extend the same slot independently of selection order", () => {
    const a = generateProject(baseRequest({ addons: ["ui/fixture-alpha", "ui/fixture-beta"] }), options);
    const b = generateProject(baseRequest({ addons: ["ui/fixture-beta", "ui/fixture-alpha"] }), options);
    expect(Buffer.from(a.zip).equals(Buffer.from(b.zip))).toBe(true);
    const build = text(
      new Map(read(a.zip)),
      "app/build.gradle.kts",
    );
    expect(build).toContain("libs.fixture.alpha");
    expect(build).toContain("libs.fixture.beta");
    expect(build.indexOf("libs.fixture.alpha")).toBeLessThan(build.indexOf("libs.fixture.beta"));
  });

  test("merges settings includes and root plugins", () => {
    const project = materializeProject(baseRequest({ addons: ["tooling/fixture-settings"] }), options);
    expect(text(project.files, "settings.gradle.kts")).toContain('include(":feature:home")');
    expect(text(project.files, "build.gradle.kts")).toContain(
      "alias(libs.plugins.fixture-beta) apply false",
    );
  });

  test("references an existing version alias", () => {
    const project = materializeProject(baseRequest({ addons: ["ui/fixture-beta"] }), options);
    const catalog = parse(text(project.files, "gradle/libs.versions.toml")) as any;
    expect(catalog.libraries["fixture-beta"]).toEqual({
      module: "androidx.appcompat:appcompat",
      version: { ref: "composeBom" },
    });
    expect(catalog.versions.composeBom).toBeDefined();
  });

  test("deduplicates identical alias definitions from two addons", () => {
    const request = baseRequest({ addons: ["ui/fixture-alpha", "storage/fixture-duplicate"] });
    const project = materializeProject(request, options);
    const build = text(project.files, "app/build.gradle.kts");
    expect(build.split("implementation(libs.fixture-alpha)").length - 1).toBe(1);
  });

  test("rejects the same alias with incompatible values", () => {
    const request = baseRequest({ addons: ["ui/fixture-alpha", "storage/fixture-conflict"] });
    expectCode(() => generateProject(request, options), "RESOLUTION_ERROR");
  });

  test("rejects a stale slot when the template marker disappears", () => {
    const project = materializeProject(baseRequest(), options);
    project.files.set(
      "app/build.gradle.kts",
      new TextEncoder().encode(
        text(project.files, "app/build.gradle.kts").replace("// @initializr-slot app-dependencies", ""),
      ),
    );
    expectCode(
      () => applyComposition([staleSlotAddon], project.files, new Map(), {}, fixtureFragments),
      "TEMPLATE_ERROR",
    );
  });

  test("rejects add operations on protected template files", () => {
    const protectedAddon = stableAddon("storage/fixture-protected", {
      fileOperations: [{ type: "add", path: "settings.gradle.kts", template: "fixtures/screen" }],
    });
    const request = baseRequest({ addons: ["storage/fixture-protected"] });
    expectCode(
      () => generateProject(request, { addons: [...allFixtureAddons, protectedAddon], fragments: fixtureFragments }),
      "RESOLUTION_ERROR",
    );
  });

  test("rejects legacy modify and append operations explicitly", () => {
    for (const type of ["modify", "append"] as const) {
      const addon = stableAddon("storage/fixture-legacy", {
        fileOperations: [{ type, path: "settings.gradle.kts", template: "fixtures/screen" }],
      });
      const request = baseRequest({ addons: ["storage/fixture-legacy"] });
      expectCode(
        () => generateProject(request, { addons: [...allFixtureAddons, addon], fragments: fixtureFragments }),
        "TEMPLATE_ERROR",
      );
    }
  });

  test("fails atomically and leaves the minimal template intact", () => {
    const minimalBefore = generateProject(baseRequest());
    expectCode(
      () => generateProject(baseRequest({ addons: ["ui/fixture-alpha", "storage/fixture-conflict"] }), options),
      "RESOLUTION_ERROR",
    );
    const minimalAfter = generateProject(baseRequest());
    expect(Buffer.from(minimalBefore.zip).equals(Buffer.from(minimalAfter.zip))).toBe(true);
    expect(minimalAfter.plan.operations).toEqual([]);
  });

  test("reports operations in the GenerationPlan", () => {
    const plan = materializeProject(baseRequest({ addons: ["ui/fixture-alpha"] }), options).plan;
    expect(plan.operations.length).toBe(4);
    expect(plan.operations.map((op) => op.type)).toContain("merge");
    expect(plan.operations.map((op) => op.type)).toContain("insert");
    expect(plan.operations.map((op) => op.type)).toContain("add");
  });
});
