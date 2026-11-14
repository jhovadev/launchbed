import { describe, expect, test } from "bun:test";
import {
  applyAddonOperations,
  generateProject,
  materializeProject,
  parseRequestJson,
  renderText,
  requestHash,
} from "@android-initializr/generator";
import {
  InitializrError,
  LIMITS,
  ProjectRequestSchema,
  normalizeRequest,
  toErrorPayload,
} from "@android-initializr/schema";
import { baseRequest, stableAddon } from "./fixtures";

function expectInitializrError(fn: () => unknown, code: "INVALID_REQUEST" | "LIMIT_EXCEEDED" | "RESOLUTION_ERROR" | "TEMPLATE_ERROR" | "SECURITY_ERROR" | "ZIP_ERROR" | "IO_ERROR" | "UNKNOWN_ADDON" | "INTERNAL_ERROR"): void {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(InitializrError);
    expect((error as InitializrError).code).toBe(code);
    return;
  }
  throw new Error("Expected an InitializrError");
}

describe("request validation and limits", () => {
  test("rejects bodies above the request limit before parsing", () => {
    const body = "x".repeat(LIMITS.requestBytes + 1);
    expectInitializrError(() => parseRequestJson(body), "LIMIT_EXCEEDED");
  });

  test("rejects malformed JSON", () => {
    expectInitializrError(() => parseRequestJson("{not json"), "INVALID_REQUEST");
  });

  test("rejects unknown addons at generation time", () => {
    const request = baseRequest({ addons: ["storage/does-not-exist"] });
    expectInitializrError(() => materializeProject(request), "RESOLUTION_ERROR");
  });

  test("rejects planned catalog addons with a clear message", () => {
    const request = baseRequest({ addons: ["storage/room"] });
    try {
      materializeProject(request);
      throw new Error("expected failure");
    } catch (error) {
      expect(error).toBeInstanceOf(InitializrError);
      expect((error as InitializrError).message).toContain("planned");
    }
  });

  test("request hashing ignores JSON key order", () => {
    const a = normalizeRequest(
      ProjectRequestSchema.parse({
        projectName: "Same",
        applicationId: "com.example.same",
        namespace: "com.example.same",
        theme: { seedColor: "#112233" },
      }),
    );
    const b = normalizeRequest(
      ProjectRequestSchema.parse({
        theme: { seedColor: "#112233" },
        namespace: "com.example.same",
        applicationId: "com.example.same",
        projectName: "Same",
      }),
    );
    expect(requestHash(a)).toBe(requestHash(b));
  });
});

describe("template rendering", () => {
  test("fails closed on unknown variables", () => {
    expectInitializrError(() => renderText("hello {{unknown}}", {}, "test"), "TEMPLATE_ERROR");
  });

  test("fails on unresolved placeholders", () => {
    expectInitializrError(() => renderText("{{ a b }}", {}, "test"), "TEMPLATE_ERROR");
  });
});

describe("addon file operations", () => {
  const vars = { packagePath: "com/example/demo", projectName: "Demo" };

  test("adds and appends files from local fragments", () => {
    const addon = stableAddon("storage/alpha", {
      fileOperations: [
        { type: "add", path: "app/{{packagePath}}/Added.kt", template: "test/add" },
        { type: "append", path: "gradle.properties", template: "test/append" },
      ],
    });
    const files = new Map<string, Uint8Array>([
      ["gradle.properties", new TextEncoder().encode("first=true\n")],
    ]);
    const origins = new Map<string, "template" | "generated" | "addon">([
      ["gradle.properties", "template"],
    ]);

    applyAddonOperations([addon], files, origins, vars, {
      "test/add.txt": "package {{packagePath}}\n",
      "test/append.txt": "second=true",
    });

    const decoder = new TextDecoder();
    expect(decoder.decode(files.get("app/com/example/demo/Added.kt")!)).toBe("package com/example/demo\n");
    expect(decoder.decode(files.get("gradle.properties")!)).toBe("first=true\nsecond=true");
    expect(origins.get("app/com/example/demo/Added.kt")).toBe("addon");
  });

  test("rejects missing fragments", () => {
    const addon = stableAddon("storage/alpha");
    expectInitializrError(
      () => applyAddonOperations([addon], new Map(), new Map(), vars, {}),
      "TEMPLATE_ERROR",
    );
  });

  test("rejects modify operations instead of faking them", () => {
    const addon = stableAddon("storage/alpha", {
      fileOperations: [{ type: "modify", path: "settings.gradle.kts", template: "test/add" }],
    });
    expectInitializrError(
      () => applyAddonOperations([addon], new Map(), new Map(), vars, { "test/add.txt": "x" }),
      "TEMPLATE_ERROR",
    );
  });

  test("rejects add operations that collide with template files", () => {
    const addon = stableAddon("storage/alpha", {
      fileOperations: [{ type: "add", path: "settings.gradle.kts", template: "test/add" }],
    });
    expectInitializrError(
      () =>
        applyAddonOperations(
          [addon],
          new Map([["settings.gradle.kts", new TextEncoder().encode("existing")]]),
          new Map(),
          vars,
          { "test/add.txt": "x" },
        ),
      "TEMPLATE_ERROR",
    );
  });
});

describe("generated project security", () => {
  const project = generateProject(baseRequest());

  test("contains only safe relative paths", () => {
    for (const file of project.plan.files) {
      expect(file.path.startsWith("/")).toBe(false);
      expect(file.path.includes("..")).toBe(false);
      expect(file.path.includes("\\")).toBe(false);
      expect(file.path.includes("://")).toBe(false);
    }
  });

  test("never includes secrets, local SDK files or build output", () => {
    const paths = project.plan.files.map((file) => file.path);
    expect(paths).not.toContain("local.properties");
    expect(paths.some((path) => path.includes(".env"))).toBe(false);
    expect(paths.some((path) => path.includes("keystore"))).toBe(false);
    expect(paths.some((path) => path.startsWith("app/build/"))).toBe(false);
  });

  test("error payloads do not leak stack traces or absolute paths", () => {
    const payload = toErrorPayload(new InitializrError("INVALID_REQUEST", "Bad input."));
    expect(payload.error.message).toBe("Bad input.");
    expect(JSON.stringify(payload)).not.toContain("/home/");
    expect(JSON.stringify(payload)).not.toContain("at ");
  });
});
