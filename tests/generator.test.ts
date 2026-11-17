import { describe, expect, test } from "bun:test";
import {
  createPlan,
  createZip,
  generateProject,
  readZip,
  verifyZipAgainstPlan,
} from "@launchbed/generator";
import { LaunchbedError } from "@launchbed/schema";
import { baseRequest } from "./fixtures";

const defaultRequest = baseRequest();

describe("generator", () => {
  test("produces a plan with a stable, realistic file set", () => {
    const plan = createPlan(defaultRequest);
    expect(plan.schemaVersion).toBe(1);
    expect(plan.template.id).toBe("android-compose-minimal");
    expect(plan.totals.files).toBeGreaterThanOrEqual(34);
    expect(plan.totals.files).toBe(plan.files.length);
    expect(plan.totals.bytes).toBeGreaterThan(50_000);

    const paths = plan.files.map((file) => file.path);
    expect(paths).toEqual([...paths].sort());
    expect(paths).toContain("gradlew");
    expect(paths).toContain("gradle/wrapper/gradle-wrapper.jar");
    expect(paths).toContain("app/src/main/java/com/example/demo/MainActivity.kt");
    expect(paths).toContain("app/src/main/java/com/example/demo/ui/theme/GeneratedColors.kt");
    expect(paths).toContain("app/src/test/java/com/example/demo/GreetingTest.kt");
    expect(paths).toContain("justfile");
    expect(paths).toContain("scripts/sdk-setup.sh");
    expect(paths).toContain("scripts/sdk-setup.ps1");
  });

  test("is byte-for-byte deterministic", () => {
    const first = generateProject(defaultRequest);
    const second = generateProject(baseRequest());
    expect(Buffer.from(first.zip).equals(Buffer.from(second.zip))).toBe(true);
    expect(first.plan.request.hash).toBe(second.plan.request.hash);
    expect(first.fileName).toBe(second.fileName);
  });

  test("ZIP matches the GenerationPlan exactly", () => {
    const project = generateProject(defaultRequest);
    verifyZipAgainstPlan(project.zip, project.plan);
    const entries = readZip(project.zip);
    expect(entries.map((entry) => entry.path)).toEqual(project.plan.files.map((file) => file.path));
    for (const entry of entries) {
      const planned = project.plan.files.find((file) => file.path === entry.path)!;
      expect(entry.size).toBe(planned.size);
    }
  });

  test("only gradlew and shell scripts are executable", () => {
    const entries = readZip(generateProject(defaultRequest).zip);
    const executable = entries.filter((entry) => entry.executable).map((entry) => entry.path);
    expect(executable).toContain("gradlew");
    expect(executable).toContain("scripts/doctor.sh");
    expect(executable).not.toContain("gradlew.bat");
    expect(executable).not.toContain("README.md");
  });

  test("uses applicationId, namespace and packageName independently", () => {
    const request = baseRequest({
      projectName: "Independent Ids",
      applicationId: "com.published.app",
      namespace: "com.internal.namespace",
      packageName: "com.source.code",
    });
    const project = generateProject(request);
    const render = (path: string) =>
      new TextDecoder().decode(readZip(project.zip).find((entry) => entry.path === path)!.data);

    const activity = render("app/src/main/java/com/source/code/MainActivity.kt");
    expect(activity).toContain("package com.source.code");
    expect(activity).not.toContain("com.published.app");

    const buildFile = render("app/build.gradle.kts");
    expect(buildFile).toContain('applicationId = "com.published.app"');
    expect(buildFile).toContain('namespace = "com.internal.namespace"');

    const home = render("app/src/main/java/com/source/code/ui/HomeScreen.kt");
    expect(home).toContain("com.internal.namespace.R");
  });

  test("contains no unresolved template placeholders", () => {
    const project = generateProject(defaultRequest);
    for (const entry of readZip(project.zip)) {
      if (entry.path.endsWith(".jar") || entry.path.endsWith(".png")) continue;
      const text = new TextDecoder().decode(entry.data);
      expect(text.includes("{{"), entry.path).toBe(false);
    }
  });

  test("applies theme tokens to generated Kotlin", () => {
    const request = baseRequest({
      theme: {
        ...defaultRequest.theme,
        seedColor: "#006C4C",
        overrides: { light: { primary: "#005544" }, dark: {} },
        shape: { cornerRadius: 20 },
        spacing: { xs: 2, sm: 4, md: 8, lg: 16, xl: 24 },
        components: { card: { cornerRadius: 24, elevation: 3 }, button: { cornerRadius: 8, minHeight: 52 } },
        typography: { fontFamily: "monospace" },
      },
    });
    const project = generateProject(request);
    const colors = new TextDecoder().decode(
      readZip(project.zip).find((entry) => entry.path.endsWith("GeneratedColors.kt"))!.data,
    );
    expect(colors).toContain("internal val LightPrimary = Color(0xFF005544)");
    const tokens = new TextDecoder().decode(
      readZip(project.zip).find((entry) => entry.path.endsWith("GeneratedTokens.kt"))!.data,
    );
    expect(tokens).toContain("internal val AppFontFamily = FontFamily.Monospace");
    expect(tokens).toContain("internal val BaseCornerRadius = 20.dp");
    expect(tokens).toContain("val cardElevation = 3.dp");
    expect(tokens).toContain("val buttonMinHeight = 52.dp");
  });

  test("changes output paths and content when the package changes", () => {
    const a = generateProject(baseRequest({ namespace: "com.example.a", packageName: "com.example.a", applicationId: "com.example.a" }));
    const b = generateProject(baseRequest({ namespace: "com.example.b", packageName: "com.example.b", applicationId: "com.example.b" }));
    expect(a.plan.request.hash).not.toBe(b.plan.request.hash);
    expect(a.plan.files.map((file) => file.path)).not.toEqual(b.plan.files.map((file) => file.path));
  });

  test("creates a real ZIP within the configured limits", () => {
    const project = generateProject(defaultRequest);
    expect(project.zip[0]).toBe(0x50);
    expect(project.zip[1]).toBe(0x4b);
    expect(project.zip.length).toBeLessThan(8 * 1024 * 1024);
    expect(project.plan.totals.bytes).toBeLessThan(8 * 1024 * 1024);
  });

  test("rejects ZIP entries that try to escape the project root", () => {
    expect(() => createZip([{ path: "../evil.txt", data: new Uint8Array([1]) }])).toThrow(LaunchbedError);
    expect(() => createZip([{ path: "/etc/passwd", data: new Uint8Array([1]) }])).toThrow(LaunchbedError);
    expect(() => createZip([{ path: "C:/Windows/evil", data: new Uint8Array([1]) }])).toThrow(LaunchbedError);
  });
});
