import { describe, expect, test } from "bun:test";
import { LaunchbedError } from "@launchbed/schema";
import { materializeProject, createPlan, formatNewCommand, collectDoctorReport, EXPO_PINS, FLUTTER_PINS, withDelegateOutputPath } from "@launchbed/generator";
import { resolveAddons } from "@launchbed/resolver";
import { ALL_ADDONS } from "@launchbed/catalog";
import { baseRequest } from "./fixtures";

describe("multi-target domain", () => {
  test("defaults to android-compose and keeps plan/ZIP fields", async () => {
    const project = await materializeProject(baseRequest());
    expect(project.plan.target).toBe("android-compose");
    expect(project.plan.strategy).toBe("owned");
    expect(project.plan.steps).toEqual([]);
    expect(project.files.has("launchbed.json")).toBe(true);
    const config = JSON.parse(new TextDecoder().decode(project.files.get("launchbed.json")!));
    expect(config.target).toBe("android-compose");
  });

  test("rejects Compose UI addons on Expo with a stable code and a clear rule", async () => {
    try {
      await materializeProject(baseRequest({ target: "expo", addons: ["ui/catalog"] }));
      throw new Error("expected failure");
    } catch (error) {
      expect(error).toBeInstanceOf(LaunchbedError);
      const typed = error as LaunchbedError;
      expect(typed.code).toBe("INCOMPATIBLE_ADDON");
      expect(typed.message).toContain("Jetpack Compose");
      expect(typed.message).toContain("expo");
    }
  });

  test("rejects an Android-only preset on Flutter", async () => {
    try {
      await materializeProject(baseRequest({ target: "flutter", preset: "compose-minimal" }));
      throw new Error("expected failure");
    } catch (error) {
      expect((error as LaunchbedError).code).toBe("INCOMPATIBLE_ADDON");
    }
  });

  test("rejects planned targets", () => {
    expect(() => resolveAddons(baseRequest({ target: "tauri-solid" }), ALL_ADDONS)).toThrow(/planned/);
  });

  test("formatNewCommand includes --target only when it is not the default", () => {
    expect(formatNewCommand({ projectName: "Demo", applicationId: "com.example.demo", target: "expo", out: "demo" })).toContain("--target expo");
    expect(formatNewCommand({ projectName: "Demo", applicationId: "com.example.demo", target: "android-compose", out: "demo" })).not.toContain("--target");
  });

  test("doctor reports a structured result per target", () => {
    const report = collectDoctorReport("expo");
    expect(report.target).toBe("expo");
    expect(report.checks.some((check) => check.id === "node")).toBe(true);
    expect(report.checks.some((check) => check.id === "npx")).toBe(true);
  });
});

describe("expo delegate plan", () => {
  test("builds a deterministic official command and overlays", async () => {
    const first = await createPlan(baseRequest({ target: "expo", addons: ["tooling/scrcpy"] }));
    const second = await createPlan(baseRequest({ target: "expo", addons: ["tooling/scrcpy"] }));
    expect(first.strategy).toBe("delegate");
    expect(first.target).toBe("expo");
    expect(first.request.hash).toBe(second.request.hash);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    const [step] = first.steps;
    expect(step?.command).toBe("npx");
    expect(step?.argv).toEqual([
      "--yes",
      `${EXPO_PINS.createPackage}@${EXPO_PINS.createVersion}`,
      "demo-app",
      "--template",
      EXPO_PINS.template,
      "--yes",
      "--no-agents-md",
    ]);
    const paths = first.files.map((file) => file.path);
    expect(paths).toContain("mise.toml");
    expect(paths).toContain("justfile");
    expect(paths).toContain("tokens/tokens.ts");
    expect(paths).toContain("tokens/tokens.css");
    expect(paths).toContain(".github/workflows/ci.yml");
    expect(paths).toContain("AGENTS.md");
    expect(paths).toContain("launchbed.json");
    const mise = (await materializeProject(baseRequest({ target: "expo", addons: ["tooling/scrcpy"] }))).files;
    const miseText = new TextDecoder().decode(mise.get("mise.toml")!);
    expect(miseText).toContain(`node = "${EXPO_PINS.node}"`);
    expect(miseText).toContain(`bun = "${EXPO_PINS.bun}"`);
    expect(miseText).toContain('"github:Genymobile/scrcpy" = "5.0.1"');
    const justfile = new TextDecoder().decode(mise.get("justfile")!);
    expect(justfile).toMatch(/^dev:/m);
    expect(justfile).toMatch(/^android:/m);
    expect(justfile).toMatch(/^ios:/m);
    expect(justfile).toMatch(/^lint:/m);
    expect(justfile).toMatch(/^test:/m);
    expect(justfile).toMatch(/^prebuild:/m);
    expect(justfile).toMatch(/^eas-build /m);
    expect(justfile).toMatch(/^mirror /m);
    const workflow = new TextDecoder().decode(mise.get(".github/workflows/ci.yml")!);
    expect(workflow).toContain("expo export --platform web");
    expect(workflow).not.toMatch(/\$\{\{\s*secrets/);
    const resolved = withDelegateOutputPath(step!.argv, "/tmp/launchbed-expo-out");
    expect(resolved).toContain(EXPO_PINS.template);
    expect(resolved[resolved.indexOf("--template") + 1]).toBe(EXPO_PINS.template);
    expect(resolved).toContain("/tmp/launchbed-expo-out");
    expect(resolved).not.toContain("/tmp/launchbed-expo-out@sdk-58");
  });
});

describe("flutter delegate plan", () => {
  test("pins flutter create argv and writes Dart token overlays", async () => {
    const plan = await createPlan(baseRequest({ target: "flutter" }));
    expect(plan.strategy).toBe("delegate");
    expect(plan.steps[0]?.command).toBe("flutter");
    expect(plan.steps[0]?.argv).toContain("--template");
    expect(plan.steps[0]?.argv).toContain(FLUTTER_PINS.template);
    expect(plan.steps[0]?.argv).toContain("--platforms");
    expect(plan.steps[0]?.argv).toContain(FLUTTER_PINS.platforms);
    expect(plan.steps[0]?.argv).toContain("--no-pub");
    expect(plan.steps[0]?.argv).toContain("--empty");
    expect(plan.steps[0]?.argv).toContain("demo_app");
    const project = await materializeProject(baseRequest({ target: "flutter" }));
    const mise = new TextDecoder().decode(project.files.get("mise.toml")!);
    expect(mise).toContain(`flutter = "${FLUTTER_PINS.sdk}"`);
    expect(project.files.has("lib/tokens/tokens.dart")).toBe(true);
    expect(project.files.has("justfile")).toBe(true);
    const justfile = new TextDecoder().decode(project.files.get("justfile")!);
    expect(justfile).toMatch(/^lint:\n    flutter analyze/m);
  });
});
