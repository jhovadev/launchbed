import { describe, expect, test } from "bun:test";
import { materializeProject } from "@launchbed/generator";
import { findAddon, isGeneratable } from "@launchbed/catalog";
import { baseRequest } from "./fixtures";

describe("tooling/github-actions", () => {
  test("catalog marks the addon as generatable", () => {
    const addon = findAddon("tooling/github-actions");
    expect(addon).toBeDefined();
    expect(isGeneratable(addon!)).toBe(true);
    expect(addon!.requirements.jdk).toBe(21);
    expect(addon!.requirements.compileSdk).toBe(37);
  });

  test("writes a secrets-free workflow and docs, and is not on a minimal project", async () => {
    const withAddon = await materializeProject(baseRequest({ addons: ["tooling/github-actions"] }));
    expect(withAddon.files.has(".github/workflows/ci.yml")).toBe(true);
    expect(withAddon.files.has("docs/CI.md")).toBe(true);
    const workflow = new TextDecoder().decode(withAddon.files.get(".github/workflows/ci.yml")!);
    expect(workflow).toContain("permissions:\n  contents: read");
    expect(workflow).toContain("java-version: \"21\"");
    expect(workflow).toContain("distribution: temurin");
    expect(workflow).toContain("platforms;android-37.0");
    expect(workflow).toContain("build-tools;36.0.0");
    expect(workflow).toContain("./gradlew :app:testDebugUnitTest");
    expect(workflow).toContain("./gradlew :app:assembleDebug");
    expect(workflow).toContain("./gradlew :app:lintDebug");
    expect(workflow).toContain("actions/upload-artifact@v4");
    expect(workflow).not.toContain("${{");
    expect(workflow).not.toContain("{{");

    const docs = new TextDecoder().decode(withAddon.files.get("docs/CI.md")!);
    expect(docs).toContain("android-37.0");
    expect(docs).not.toContain("{{");

    const minimal = await materializeProject(baseRequest());
    expect(minimal.files.has(".github/workflows/ci.yml")).toBe(false);
    expect(minimal.files.has("docs/CI.md")).toBe(false);
  });

  test("app-starter and compose-starter include the workflow", async () => {
    for (const preset of ["app-starter", "compose-starter"] as const) {
      const project = await materializeProject(baseRequest({ preset }));
      expect(project.files.has(".github/workflows/ci.yml")).toBe(true);
    }
    const notes = await materializeProject(baseRequest({ preset: "local-notes" }));
    expect(notes.files.has(".github/workflows/ci.yml")).toBe(false);
  });
});
