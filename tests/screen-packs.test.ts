import { describe, expect, test } from "bun:test";
import { LaunchbedError } from "@launchbed/schema";
import { materializeProject } from "@launchbed/generator";
import { previewTabs } from "@launchbed/preview/tabs";
import { baseRequest } from "./fixtures";

const decode = (bytes: Uint8Array | undefined) => (bytes ? new TextDecoder().decode(bytes) : "");

async function files(target: "expo" | "flutter", overrides: Record<string, unknown>) {
  const project = await materializeProject(baseRequest({ target, ...overrides }));
  return project.files;
}

describe("Expo and Flutter screen packs", () => {
  test("app-starter maps to the per-target add-ons on Expo", async () => {
    const tree = await files("expo", { preset: "app-starter" });
    for (const path of [
      "src/app/index.tsx",
      "src/app/onboarding.tsx",
      "src/app/login.tsx",
      "src/app/register.tsx",
      "src/app/(tabs)/_layout.tsx",
      "src/app/(tabs)/home.tsx",
      "src/app/(tabs)/profile.tsx",
      "src/app/profile-edit.tsx",
      "src/launchbed/auth/validation.ts",
      "src/launchbed/auth/fake-auth.ts",
      "src/launchbed/auth/auth.test.js",
    ]) {
      expect(tree.has(path)).toBe(true);
    }
    expect(decode(tree.get("src/launchbed/config.ts"))).toContain('"Demo App"');
  });

  test("app-starter maps to the per-target add-ons on Flutter", async () => {
    const tree = await files("flutter", { preset: "app-starter" });
    for (const path of [
      "lib/main.dart",
      "lib/launchbed/app.dart",
      "lib/launchbed/app_shell.dart",
      "lib/launchbed/auth/auth_validator.dart",
      "lib/launchbed/auth/fake_auth_repository.dart",
      "test/auth_validator_test.dart",
      "test/fake_auth_repository_test.dart",
      "test/app_flow_test.dart",
    ]) {
      expect(tree.has(path)).toBe(true);
    }
    expect(decode(tree.get("test/auth_validator_test.dart"))).toContain("package:demo_app/");
  });

  test("only selected features are emitted", async () => {
    const tree = await files("expo", { addons: ["ui/navigation", "ui/onboarding"] });
    expect(tree.has("src/app/onboarding.tsx")).toBe(true);
    expect(tree.has("src/app/login.tsx")).toBe(false);
    expect(tree.has("src/app/(tabs)/profile.tsx")).toBe(false);
    expect(decode(tree.get("src/app/(tabs)/_layout.tsx"))).toContain('{ display: "none" }');
    const flutter = await files("flutter", { addons: ["ui/navigation"] });
    expect(flutter.has("lib/launchbed/screens/login_screen.dart")).toBe(false);
    expect(flutter.has("test/auth_validator_test.dart")).toBe(false);
  });

  test("no ui/navigation means no screen pack", async () => {
    const tree = await files("expo", { addons: ["tooling/scrcpy"] });
    expect(tree.has("src/launchbed/config.ts")).toBe(false);
    expect(tree.has("src/app/onboarding.tsx")).toBe(false);
  });

  test("is deterministic", async () => {
    for (const target of ["expo", "flutter"] as const) {
      const a = await files(target, { preset: "app-starter" });
      const b = await files(target, { preset: "app-starter" });
      expect([...a.keys()]).toEqual([...b.keys()]);
      for (const [path, bytes] of a) expect(decode(b.get(path))).toBe(decode(bytes));
    }
  });

  test("Compose-only presets are rejected per target with a clear error", async () => {
    try {
      await materializeProject(baseRequest({ target: "expo", preset: "local-notes" }));
      throw new Error("expected failure");
    } catch (error) {
      expect(error).toBeInstanceOf(LaunchbedError);
      expect((error as LaunchbedError).message).toContain("does not apply to the expo target");
    }
  });

  test("Compose-only screen add-ons are rejected on delegates", async () => {
    await expect(materializeProject(baseRequest({ target: "flutter", addons: ["ui/navigation", "ui/catalog"] }))).rejects.toBeInstanceOf(LaunchbedError);
  });
});

describe("web preview tabs mirror the generated app", () => {
  const starterCompose = ["ui/navigation", "ui/onboarding", "ui/auth", "ui/dashboard", "ui/profile", "ui/settings"];

  test("Compose: same order as TopLevelRoutes", async () => {
    const project = await materializeProject(baseRequest({ preset: "app-starter" }));
    const kt = decode(project.files.get("app/src/main/java/com/example/demo/ui/navigation/TopLevelDestinations.kt"));
    const routes = /listOf\(([^)]*)\)/.exec(kt)?.[1]?.split(",").map((part) => part.trim().replace("AppRoute.", "").toLowerCase()) ?? [];
    expect(previewTabs("android-compose", starterCompose).map((tab) => tab.screen)).toEqual(routes as never);
    expect(previewTabs("android-compose", ["ui/navigation", "ui/notes"])).toHaveLength(1);
    expect(previewTabs("android-compose", ["ui/dashboard", "ui/profile"])).toEqual([]);
  });

  test("Expo and Flutter: same tabs as the shells", async () => {
    const expo = await files("expo", { preset: "app-starter" });
    const layout = decode(expo.get("src/app/(tabs)/_layout.tsx"));
    const titles = [...layout.matchAll(/title: "([^"]+)"/g)].map((match) => match[1]);
    expect(previewTabs("expo", ["ui/navigation", "ui/dashboard", "ui/profile", "ui/settings"]).map((tab) => tab.label)).toEqual(titles as string[]);
    const flutter = await files("flutter", { preset: "app-starter" });
    const shell = decode(flutter.get("lib/launchbed/app_shell.dart"));
    for (const tab of previewTabs("flutter", ["ui/navigation", "ui/dashboard", "ui/profile", "ui/settings"])) expect(shell).toContain(`label: '${tab.label}'`);
    expect(previewTabs("expo", ["ui/navigation"]).map((tab) => tab.screen)).toEqual(["welcome"]);
  });
});
