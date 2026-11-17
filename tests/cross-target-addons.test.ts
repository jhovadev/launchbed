import { describe, expect, test } from "bun:test";
import { ALL_ADDONS } from "@launchbed/catalog";
import { materializeProject } from "@launchbed/generator";
import { baseRequest } from "./fixtures";

const decode = (bytes: Uint8Array | undefined) => (bytes ? new TextDecoder().decode(bytes) : "");
const NEW_ADDONS = ["storage/key-value", "network/http-client", "tooling/format"];

describe("cross-target addons (storage/key-value, network/http-client, tooling/format)", () => {
  test("are beta on all three targets", () => {
    for (const id of NEW_ADDONS) {
      const addon = ALL_ADDONS.find((candidate) => candidate.id === id)!;
      expect(addon.status).toBe("beta");
      expect([...addon.targets].sort()).toEqual(["android-compose", "expo", "flutter"]);
    }
  });

  test("Compose: DataStore store, Ktor client with MockEngine test, INTERNET permission, ktlint", async () => {
    const project = await materializeProject(baseRequest({ addons: NEW_ADDONS }));
    const files = project.files;
    expect(files.has("app/src/main/java/com/example/demo/data/prefs/KeyValueStore.kt")).toBe(true);
    expect(files.has("app/src/test/java/com/example/demo/data/prefs/KeyValueStoreTest.kt")).toBe(true);
    expect(files.has("app/src/test/java/com/example/demo/data/network/ApiClientTest.kt")).toBe(true);
    const manifest = decode(files.get("app/src/main/AndroidManifest.xml"));
    expect(manifest).toContain('<uses-permission android:name="android.permission.INTERNET" />');
    expect(manifest.indexOf("uses-permission")).toBeLessThan(manifest.indexOf("<application"));
    const catalog = decode(files.get("gradle/libs.versions.toml"));
    expect(catalog).toContain('ktor = "3.6.1"');
    expect(decode(files.get("app/build.gradle.kts"))).toContain("testImplementation(libs.ktorclientmock)");
    expect(decode(files.get("mise.toml"))).toContain('ktlint = "1.8.0"');
    expect(decode(files.get("justfile"))).toContain("format-check:");
  });

  test("Compose without the network addon keeps a valid manifest and no INTERNET permission", async () => {
    const project = await materializeProject(baseRequest({ addons: [] }));
    const manifest = decode(project.files.get("app/src/main/AndroidManifest.xml"));
    expect(manifest).not.toContain("uses-permission");
    expect(manifest).toContain("<!-- @launchbed-slot manifest-permissions -->");
  });

  test("Expo: files, pinned packages and a Prettier step", async () => {
    const project = await materializeProject(baseRequest({ target: "expo", addons: NEW_ADDONS }));
    for (const path of ["src/launchbed/storage/key-value.ts", "src/launchbed/network/http-client.ts", "src/launchbed/network/http-client.test.js", ".prettierrc.json"]) {
      expect(project.files.has(path)).toBe(true);
    }
    const argv = project.plan.steps.slice(1).map((step) => step.argv.join(" "));
    expect(argv).toContain("expo install @react-native-async-storage/async-storage@2.2.0");
    expect(argv.some((line) => line.includes("prettier@3.10.1") && line.includes("--write"))).toBe(true);
    expect(decode(project.files.get("justfile"))).toContain("bun test src/launchbed");
  });

  test("Flutter: files, one pub add with every pin, dart format step", async () => {
    const project = await materializeProject(baseRequest({ target: "flutter", preset: "app-starter", addons: NEW_ADDONS }));
    expect(project.files.has("lib/launchbed/network/api_client.dart")).toBe(true);
    expect(decode(project.files.get("test/api_client_test.dart"))).toContain("package:demo_app/launchbed/network/api_client.dart");
    const steps = project.plan.steps.slice(1);
    expect(steps[0]!.argv).toEqual(["pub", "add", "http:1.6.0", "shared_preferences:2.5.6"]);
    expect(steps[1]).toMatchObject({ command: "dart", argv: ["format", "lib", "test"] });
    expect(decode(project.files.get("analysis_options.yaml"))).toContain("page_width: 120");
  });

  test("delegate packages are exact pins", () => {
    for (const addon of ALL_ADDONS) {
      for (const pkg of [...(addon.delegatePackages.expo ?? []), ...(addon.delegatePackages.flutter ?? [])]) {
        expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/);
      }
    }
  });
});
