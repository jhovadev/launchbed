import { describe, expect, test } from "bun:test";
import {
  generateProject,
  materializeProject,
  parseRequestJson,
  renderText,
  requestHash,
} from "@launchbed/generator";
import {
  LaunchbedError,
  LIMITS,
  ProjectRequestSchema,
  normalizeRequest,
  toErrorPayload,
} from "@launchbed/schema";
import { baseRequest } from "./fixtures";

function expectLaunchbedError(fn: () => unknown, code: "INVALID_REQUEST" | "LIMIT_EXCEEDED" | "RESOLUTION_ERROR" | "TEMPLATE_ERROR" | "SECURITY_ERROR" | "ZIP_ERROR" | "IO_ERROR" | "UNKNOWN_ADDON" | "INTERNAL_ERROR"): void {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(LaunchbedError);
    expect((error as LaunchbedError).code).toBe(code);
    return;
  }
  throw new Error("Expected an LaunchbedError");
}

describe("request validation and limits", () => {
  test("rejects bodies above the request limit before parsing", () => {
    const body = "x".repeat(LIMITS.requestBytes + 1);
    expectLaunchbedError(() => parseRequestJson(body), "LIMIT_EXCEEDED");
  });

  test("rejects malformed JSON", () => {
    expectLaunchbedError(() => parseRequestJson("{not json"), "INVALID_REQUEST");
  });

  test("rejects unknown addons at generation time", () => {
    const request = baseRequest({ addons: ["storage/does-not-exist"] });
    expectLaunchbedError(() => materializeProject(request), "RESOLUTION_ERROR");
  });

  test("rejects planned catalog addons with a clear message", () => {
    const request = baseRequest({ addons: ["storage/turso"] });
    try {
      materializeProject(request);
      throw new Error("expected failure");
    } catch (error) {
      expect(error).toBeInstanceOf(LaunchbedError);
      expect((error as LaunchbedError).message).toContain("planned");
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
    expectLaunchbedError(() => renderText("hello {{unknown}}", {}, "test"), "TEMPLATE_ERROR");
  });

  test("fails on unresolved placeholders", () => {
    expectLaunchbedError(() => renderText("{{ a b }}", {}, "test"), "TEMPLATE_ERROR");
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
    const payload = toErrorPayload(new LaunchbedError("INVALID_REQUEST", "Bad input."));
    expect(payload.error.message).toBe("Bad input.");
    expect(JSON.stringify(payload)).not.toContain("/home/");
    expect(JSON.stringify(payload)).not.toContain("at ");
  });
});
