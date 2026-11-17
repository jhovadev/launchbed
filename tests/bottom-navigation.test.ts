import { describe, expect, test } from "bun:test";
import { materializeProject, topLevelDestinations } from "@launchbed/generator";
import { baseRequest } from "./fixtures";

const NAV = "app/src/main/java/com/example/demo/ui/navigation";

function text(files: Map<string, Uint8Array>, path: string): string {
  const bytes = files.get(path);
  if (!bytes) throw new Error(`missing ${path}`);
  return new TextDecoder().decode(bytes);
}

describe("bottom navigation for top-level screens", () => {
  test("app-starter gets Home, Profile and Settings tabs with the home tab first", async () => {
    const project = await materializeProject(baseRequest({ preset: "app-starter" }));
    const topLevel = text(project.files, `${NAV}/TopLevelDestinations.kt`);
    expect(topLevel).toContain("val TopLevelRoutes: List<AppRoute> = listOf(AppRoute.Dashboard, AppRoute.Profile, AppRoute.Settings)");
    expect(topLevel).toContain('AppRoute.Dashboard -> "Home"');
    expect(topLevel).toContain("AppRoute.Profile -> Icons.Filled.Person");
    expect(topLevel).toContain("import androidx.compose.material.icons.filled.Settings");
    expect(topLevel).toContain("NavigationBarItem(");
    const appRoot = text(project.files, `${NAV}/AppRoot.kt`);
    expect(appRoot).toContain("if (shouldShowBottomBar(current))");
    expect(appRoot).toContain("backStack.selectTopLevel(it)");
    expect(appRoot).toContain("consumeWindowInsets(innerPadding)");
    expect(project.files.has("app/src/test/java/com/example/demo/ui/navigation/TopLevelNavigationTest.kt")).toBe(true);
    expect(project.files.has("app/src/androidTest/java/com/example/demo/ui/navigation/AppBottomBarTest.kt")).toBe(true);
  });

  test("a single screen add-on keeps one destination, so the bar stays hidden", async () => {
    const project = await materializeProject(baseRequest({ preset: "local-notes" }));
    const topLevel = text(project.files, `${NAV}/TopLevelDestinations.kt`);
    expect(topLevel).toContain("listOf(AppRoute.Notes)");
    expect(topLevel).toContain("TopLevelRoutes.size >= 2");
  });

  test("navigation without screen add-ons compiles to an empty, icon-free list", async () => {
    const project = await materializeProject(baseRequest({ addons: ["ui/navigation"] }));
    const topLevel = text(project.files, `${NAV}/TopLevelDestinations.kt`);
    expect(topLevel).toContain("val TopLevelRoutes: List<AppRoute> = listOf()");
    expect(topLevel).not.toContain("material.icons");
  });

  test("compose-minimal has no navigation files at all", async () => {
    const project = await materializeProject(baseRequest({ preset: "compose-minimal" }));
    expect([...project.files.keys()].some((path) => path.includes("TopLevelDestinations"))).toBe(false);
  });

  test("tab order is stable and independent of selection order", () => {
    const a = topLevelDestinations(["ui/settings", "ui/profile", "ui/dashboard", "ui/notes"]).map((d) => d.route);
    const b = topLevelDestinations(new Set(["ui/notes", "ui/dashboard", "ui/profile", "ui/settings"])).map((d) => d.route);
    expect(a).toEqual(["Dashboard", "Notes", "Profile", "Settings"]);
    expect(b).toEqual(a);
    // Without a dashboard the generated home route (Settings before Notes) leads.
    expect(topLevelDestinations(["ui/notes", "ui/settings"]).map((d) => d.route)).toEqual(["Settings", "Notes"]);
  });
});
