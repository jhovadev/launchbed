import { describe, expect, test } from "bun:test";
import {
  AddonManifestSchema,
  DEFAULT_SDK,
  ProjectRequestSchema,
  ThemeConfigSchema,
  normalizeRequest,
  validatePackageId,
  validateRelativePath,
  type ProjectRequest,
} from "@launchbed/schema";

export function baseRequest(overrides: Partial<ProjectRequest> = {}): ProjectRequest {
  return normalizeRequest(
    ProjectRequestSchema.parse({
      projectName: "Demo App",
      applicationId: "com.example.demo",
      namespace: "com.example.demo",
      ...overrides,
    }),
  );
}

export function stableAddon(id: string, overrides: Record<string, unknown> = {}) {
  const [category] = id.split("/");
  return AddonManifestSchema.parse({
    id,
    version: "0.1.0",
    displayName: id,
    description: `Test addon ${id}`,
    category,
    status: "stable",
    dependencies: [],
    conflicts: [],
    capabilities: [],
    requirements: {},
    fileOperations: [
      { type: "add", path: `addons/${id.split("/")[1]}.txt`, template: "test/fragment" },
    ],
    compatibility: { android: ["8.0+"], notes: [] },
    license: "MIT",
    ...overrides,
  });
}

describe("ProjectRequestSchema", () => {
  test("applies documented defaults", () => {
    const request = ProjectRequestSchema.parse({
      projectName: "My App",
      applicationId: "com.example.myapp",
      namespace: "com.example.myapp",
    });
    expect(request.template).toBe("android-compose-minimal");
    expect(request.minSdk).toBe(DEFAULT_SDK.min);
    expect(request.compileSdk).toBe(DEFAULT_SDK.compile);
    expect(request.targetSdk).toBe(DEFAULT_SDK.target);
    expect(request.addons).toEqual([]);
    expect(request.theme.seedColor).toBe("#6750A4");
    expect(request.packageName).toBeUndefined();
  });

  test("normalization defaults packageName to namespace and sorts addons", () => {
    const request = normalizeRequest(
      ProjectRequestSchema.parse({
        projectName: "My App",
        applicationId: "com.example.myapp",
        namespace: "com.acme.namespace",
        addons: ["ui/login", "storage/room"],
      }),
    );
    expect(request.packageName).toBe("com.acme.namespace");
    expect(request.addons).toEqual(["storage/room", "ui/login"]);
  });

  test("keeps applicationId and namespace independent", () => {
    const request = baseRequest({
      applicationId: "com.example.published",
      namespace: "com.example.internal",
      packageName: "com.example.source",
    });
    expect(request.applicationId).toBe("com.example.published");
    expect(request.namespace).toBe("com.example.internal");
    expect(request.packageName).toBe("com.example.source");
  });

  test("rejects SDK combinations that cannot compile", () => {
    const result = ProjectRequestSchema.safeParse({
      projectName: "Bad",
      applicationId: "com.example.bad",
      namespace: "com.example.bad",
      minSdk: 36,
      targetSdk: 30,
      compileSdk: 34,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join(".") === "targetSdk")).toBe(true);
    }
  });

  test("rejects java keywords and unsafe package segments", () => {
    expect(validatePackageId("com.class.app").length).toBeGreaterThan(0);
    expect(validatePackageId("com.9example.app").length).toBeGreaterThan(0);
    expect(validatePackageId("com..app").length).toBeGreaterThan(0);
    expect(validatePackageId("com.example.app").length).toBe(0);
  });

  test("rejects unknown keys instead of silently ignoring them", () => {
    const result = ProjectRequestSchema.safeParse({
      projectName: "My App",
      applicationId: "com.example.myapp",
      namespace: "com.example.myapp",
      minSdk: 26,
      evil: "../../etc/passwd",
    });
    expect(result.success).toBe(false);
  });

  test("rejects duplicate addons", () => {
    const result = ProjectRequestSchema.safeParse({
      projectName: "My App",
      applicationId: "com.example.myapp",
      namespace: "com.example.myapp",
      addons: ["ui/login", "ui/login"],
    });
    expect(result.success).toBe(false);
  });
});

describe("ThemeConfigSchema", () => {
  test("supports semantic overrides and component tokens", () => {
    const theme = ThemeConfigSchema.parse({
      seedColor: "#006C4C",
      overrides: { light: { primary: "#005544" } },
      components: { card: { cornerRadius: 24 } },
      typography: { fontFamily: "serif" },
    });
    expect(theme.seedColor).toBe("#006C4C");
    expect(theme.overrides.light.primary).toBe("#005544");
    expect(theme.components.card.cornerRadius).toBe(24);
    expect(theme.components.card.elevation).toBe(1);
    expect(theme.typography.fontFamily).toBe("serif");
  });

  test("rejects invalid colors", () => {
    expect(ThemeConfigSchema.safeParse({ seedColor: "purple" }).success).toBe(false);
    expect(ThemeConfigSchema.safeParse({ seedColor: "#FFF" }).success).toBe(false);
    expect(ThemeConfigSchema.safeParse({ seedColor: "#6750a4" }).success).toBe(true);
  });
});

describe("validateRelativePath", () => {
  const rejected = [
    "../escape.txt",
    "/absolute.txt",
    "C:/windows.txt",
    "a/../../b.txt",
    "a\\b.txt",
    "nul.txt",
    "folder/",
    "a//b.txt",
    "~/home.txt",
    "https://example.com/x.txt",
    "a/\u0000b.txt",
  ];

  for (const path of rejected) {
    test(`rejects ${JSON.stringify(path)}`, () => {
      expect(validateRelativePath(path).length).toBeGreaterThan(0);
    });
  }

  test("accepts normal project paths", () => {
    expect(validateRelativePath("app/src/main/java/com/example/MainActivity.kt")).toEqual([]);
    expect(validateRelativePath("gradle/wrapper/gradle-wrapper.jar")).toEqual([]);
  });
});
