import { describe, expect, test } from "bun:test";
import { generateProject, materializeProject } from "@launchbed/generator";
import { LaunchbedError } from "@launchbed/schema";
import { baseRequest } from "./fixtures";

function text(files: Map<string, Uint8Array>, path: string): string {
  return new TextDecoder().decode(files.get(path)!);
}

describe("ui addons", () => {
  test("navigation is resolved automatically for dashboard and settings", () => {
    const project = materializeProject(baseRequest({ addons: ["ui/dashboard", "ui/settings"] }));
    expect(project.plan.request.addons).toEqual(["ui/dashboard", "ui/navigation", "ui/settings"]);
  });

  test("rejects incompatible minSdk", () => {
    expect(() => baseRequest({ addons: ["ui/dashboard"], minSdk: 23 })).toThrow();
    expect(() => materializeProject(baseRequest({ addons: ["ui/dashboard"], minSdk: 24 }))).not.toThrow();
  });

  test("generates navigation, dashboard and settings files", () => {
    const project = materializeProject(baseRequest({ addons: ["ui/dashboard", "ui/settings"] }));
    const paths = project.plan.files.map((file) => file.path);
    expect(paths).toContain("app/src/main/java/com/example/demo/ui/navigation/AppRoot.kt");
    expect(paths).toContain("app/src/main/java/com/example/demo/ui/navigation/WelcomeScreen.kt");
    expect(paths).toContain("app/src/main/java/com/example/demo/ui/dashboard/DashboardScreen.kt");
    expect(paths).toContain("app/src/main/java/com/example/demo/ui/settings/SettingsScreen.kt");
  });

  test("registers destinations without duplicate imports", () => {
    const project = materializeProject(baseRequest({ addons: ["ui/dashboard", "ui/settings"] }));
    const appRoot = text(project.files, "app/src/main/java/com/example/demo/ui/navigation/AppRoot.kt");
    expect(appRoot).toContain("import com.example.demo.ui.dashboard.DashboardScreen");
    expect(appRoot).toContain("import com.example.demo.ui.settings.SettingsScreen");
    expect(appRoot.match(/import com\.example\.demo\.ui\.dashboard\.DashboardScreen/g)?.length).toBe(1);
    expect(appRoot).toContain("@Serializable data object Dashboard : AppRoute");
    expect(appRoot).toContain("@Serializable data object Settings : AppRoute");
    expect(appRoot).toContain("entry<AppRoute.Dashboard> { DashboardScreen() }");
    expect(appRoot).toContain("entry<AppRoute.Settings> { SettingsScreen() }");
  });

  test("chooses a deterministic initial destination", () => {
    const both = text(
      materializeProject(baseRequest({ addons: ["ui/dashboard", "ui/settings"] })).files,
      "app/src/main/java/com/example/demo/ui/navigation/AppRoot.kt",
    );
    expect(both).toContain("rememberNavBackStack(AppRoute.Dashboard)");
    const settingsOnly = text(
      materializeProject(baseRequest({ addons: ["ui/settings"] })).files,
      "app/src/main/java/com/example/demo/ui/navigation/AppRoot.kt",
    );
    expect(settingsOnly).toContain("rememberNavBackStack(AppRoute.Settings)");
    const navigationOnly = text(
      materializeProject(baseRequest({ addons: ["ui/navigation"] })).files,
      "app/src/main/java/com/example/demo/ui/navigation/AppRoot.kt",
    );
    expect(navigationOnly).toContain("rememberNavBackStack(AppRoute.Welcome)");
  });
});
describe("ui gradle integration", () => {
  const project = materializeProject(baseRequest({ addons: ["ui/dashboard", "ui/settings"] }));
  const build = text(project.files, "app/build.gradle.kts");
  const catalogText = text(project.files, "gradle/libs.versions.toml");

  test("adds navigation dependencies without duplicates", () => {
    expect(build).toContain("implementation(libs.navigation3runtime)");
    expect(build).toContain("implementation(libs.navigation3ui)");
    expect(build).toContain("implementation(libs.kotlinxserializationjson)");
    expect(build).toContain("alias(libs.plugins.serialization)");
    expect(build.split("implementation(libs.navigation3runtime)").length - 1).toBe(1);
  });

  test("does not add ui artifacts to the minimal project", () => {
    const minimal = materializeProject(baseRequest());
    const minimalBuild = text(minimal.files, "app/build.gradle.kts");
    expect(minimalBuild).not.toContain("navigation3");
    expect(minimalBuild).not.toContain("material-icons-core");
    expect(minimal.plan.operations).toEqual([]);
  });
});

describe("ui determinism", () => {
  test("zip is byte-identical for different selection orders", () => {
    const first = generateProject(baseRequest({ addons: ["ui/dashboard", "ui/settings"] }));
    const second = generateProject(baseRequest({ addons: ["ui/settings", "ui/dashboard"] }));
    expect(Buffer.from(first.zip).equals(Buffer.from(second.zip))).toBe(true);
  });

  test("custom namespace changes generated paths", () => {
    const project = materializeProject(baseRequest({
      projectName: "UI Demo",
      applicationId: "com.acme.mobile",
      namespace: "dev.example.notes",
      packageName: "pe.demo.inventory",
      addons: ["ui/settings"],
    }));
    expect(project.plan.files.map((file) => file.path)).toContain(
      "app/src/main/java/pe/demo/inventory/ui/settings/SettingsScreen.kt",
    );
    const screen = text(project.files, "app/src/main/java/pe/demo/inventory/ui/settings/SettingsScreen.kt");
    expect(screen).toContain("package pe.demo.inventory.ui.settings");
  });
});
