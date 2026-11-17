import { describe, expect, test } from "bun:test";
import { delegateSetupCommands } from "@launchbed/schema";
import { EXPO_PINS, FLUTTER_PINS, materializeProject, validateDelegateStep } from "@launchbed/generator";
import { previewTabs } from "@launchbed/preview/tabs";
import { baseRequest } from "./fixtures";

const decode = (bytes: Uint8Array | undefined) => (bytes ? new TextDecoder().decode(bytes) : "");

describe("delegate persistence and pinned dependency steps", () => {
  test("Expo screen pack installs a pinned AsyncStorage inside the project", async () => {
    const project = await materializeProject(baseRequest({ target: "expo", preset: "app-starter" }));
    expect(project.plan.steps).toHaveLength(2);
    const install = project.plan.steps[1]!;
    expect(install).toMatchObject({ command: "npx", cwd: "project" });
    expect(install.argv).toEqual(["expo", "install", `@react-native-async-storage/async-storage@${EXPO_PINS.asyncStorage}`]);
    expect(EXPO_PINS.asyncStorage).toMatch(/^\d+\.\d+\.\d+$/);
    expect(decode(project.files.get("src/launchbed/storage/app-store.ts"))).toContain("@react-native-async-storage/async-storage");
  });

  test("Flutter screen pack adds a pinned shared_preferences", async () => {
    const project = await materializeProject(baseRequest({ target: "flutter", preset: "app-starter" }));
    expect(project.plan.steps[1]).toMatchObject({ command: "flutter", cwd: "project", argv: ["pub", "add", `shared_preferences:${FLUTTER_PINS.sharedPreferences}`] });
    const main = decode(project.files.get("lib/main.dart"));
    expect(main).toContain("await session.load();");
    expect(main).toContain("SharedPreferencesStore()");
  });

  test("no screen pack means no dependency step", async () => {
    const project = await materializeProject(baseRequest({ target: "expo", addons: [] }));
    expect(project.plan.steps).toHaveLength(1);
  });

  test("manual setup lists the dependency step after unzip", () => {
    const lines = delegateSetupCommands({
      target: "flutter",
      step: { command: "flutter", argv: ["create", "demo_app"] },
      zipFileName: "demo-app-launchbed-overlay.zip",
      extraSteps: [{ command: "flutter", argv: ["pub", "add", "shared_preferences:2.5.6"] }],
    });
    expect(lines.slice(2)).toEqual(["unzip -o ../demo-app-launchbed-overlay.zip", "flutter pub add shared_preferences:2.5.6"]);
  });

  test("scoped npm package names pass the argv allowlist, shell syntax does not", () => {
    expect(() => validateDelegateStep({ type: "delegate", command: "npx", argv: ["expo", "install", "@react-native-async-storage/async-storage@2.2.0"], description: "x" })).not.toThrow();
    expect(() => validateDelegateStep({ type: "delegate", command: "npx", argv: ["@;rm"], description: "x" })).toThrow();
    expect(() => validateDelegateStep({ type: "delegate", command: "npx", argv: ["@@x"], description: "x" })).toThrow();
  });

  test("Expo test recipe typechecks only Launchbed files", async () => {
    const project = await materializeProject(baseRequest({ target: "expo", preset: "app-starter" }));
    const tsconfig = JSON.parse(decode(project.files.get("tsconfig.launchbed.json")));
    expect(tsconfig.extends).toBe("./tsconfig.json");
    expect(tsconfig.include).toContain("src/launchbed/**/*.tsx");
    expect(tsconfig.include.some((glob: string) => glob.startsWith("src/components") || glob.startsWith("src/constants"))).toBe(false);
    expect(decode(project.files.get("justfile"))).toContain("npx tsc --noEmit -p tsconfig.launchbed.json");
    expect(decode(project.files.get(".github/workflows/ci.yml"))).toContain("npx tsc --noEmit -p tsconfig.launchbed.json");
    const bare = await materializeProject(baseRequest({ target: "expo", addons: [] }));
    expect(JSON.parse(decode(bare.files.get("tsconfig.launchbed.json"))).include).not.toContain("src/app/**/*.tsx");
  });
});

describe("notes and settings on Expo and Flutter", () => {
  const addons = ["ui/navigation", "ui/dashboard", "ui/notes", "ui/profile", "ui/settings"];

  test("ui/notes does not pull Room on delegates but still does on Compose", async () => {
    const expo = await materializeProject(baseRequest({ target: "expo", addons: ["ui/notes"] }));
    expect(expo.plan.request.addons).toEqual(["ui/navigation", "ui/notes"]);
    const compose = await materializeProject(baseRequest({ addons: ["ui/notes"] }));
    expect(compose.plan.request.addons).toContain("storage/room");
  });

  test("tabs follow the Compose order on both shells and in the preview", async () => {
    const expo = await materializeProject(baseRequest({ target: "expo", addons }));
    const layout = decode(expo.files.get("src/app/(tabs)/_layout.tsx"));
    expect([...layout.matchAll(/title: "([^"]+)"/g)].map((match) => match[1])).toEqual(["Home", "Notes", "Profile", "Settings"]);
    for (const path of ["src/app/(tabs)/notes.tsx", "src/app/(tabs)/settings.tsx", "src/app/note.tsx", "src/launchbed/notes/notes.test.js", "components/ui/SwitchRow.tsx"]) {
      expect(expo.files.has(path)).toBe(true);
    }
    const flutter = await materializeProject(baseRequest({ target: "flutter", addons }));
    const shell = decode(flutter.files.get("lib/launchbed/app_shell.dart"));
    expect(shell.indexOf("NotesScreen()")).toBeLessThan(shell.indexOf("ProfileScreen()"));
    expect(shell.indexOf("ProfileScreen()")).toBeLessThan(shell.indexOf("SettingsScreen()"));
    expect(decode(flutter.files.get("lib/launchbed/app.dart"))).toContain("themeMode: session.themeMode");
    expect(flutter.files.has("test/notes_repository_test.dart")).toBe(true);
    expect(previewTabs("expo", addons).map((tab) => tab.screen)).toEqual(["dashboard", "notes", "profile", "settings"]);
    const config = JSON.parse(decode(flutter.files.get("launchbed.json")));
    expect(config.components).toContain("switch");
  });
});
