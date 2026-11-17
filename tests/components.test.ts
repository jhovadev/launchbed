import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test } from "bun:test";
import { contractProblems, loadComponentCatalog, addComponent } from "@launchbed/generator";
import { LaunchbedError } from "@launchbed/schema";

describe("component registry", () => {
  test("every component declares all generatable targets or an explicit reason", () => {
    const catalog = loadComponentCatalog();
    expect(catalog.components.length).toBeGreaterThanOrEqual(6);
    const names = catalog.components.map((component) => component.name).sort();
    expect(names).toEqual(["badge", "button", "card", "list-item", "switch", "text-field"]);
    for (const component of catalog.components) {
      expect(contractProblems(component)).toEqual([]);
    }
  });

  test("launchbed add is idempotent and refuses to overwrite without --force", () => {
    const root = mkdtempSync(join(tmpdir(), "launchbed-add-"));
    try {
      writeFileSync(
        join(root, "launchbed.json"),
        JSON.stringify({
          schemaVersion: 1,
          target: "android-compose",
          projectName: "Demo",
          applicationId: "com.example.demo",
          packageName: "com.example.demo",
          addons: [],
          components: [],
        }) + "\n",
      );
      const first = addComponent({ name: "button", projectRoot: root });
      expect(first.wrote).toBe(true);
      expect(first.path).toContain("LaunchbedButton.kt");
      const source = readFileSync(join(root, first.path), "utf8");
      expect(source).toContain("package com.example.demo.ui.components");
      expect(source).not.toContain("{{packageName}}");
      const second = addComponent({ name: "button", projectRoot: root });
      expect(second.wrote).toBe(false);
      mkdirSync(join(root, "app/src/main/java/com/example/demo/ui/components"), { recursive: true });
      writeFileSync(join(root, first.path), "changed\n");
      expect(() => addComponent({ name: "button", projectRoot: root })).toThrow(LaunchbedError);
      const forced = addComponent({ name: "button", projectRoot: root, force: true });
      expect(forced.wrote).toBe(true);
      const config = JSON.parse(readFileSync(join(root, "launchbed.json"), "utf8"));
      expect(config.components).toEqual(["button"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("add refuses a Compose component on an Expo project", () => {
    const root = mkdtempSync(join(tmpdir(), "launchbed-add-expo-"));
    try {
      writeFileSync(
        join(root, "launchbed.json"),
        JSON.stringify({
          schemaVersion: 1,
          target: "expo",
          projectName: "Demo",
          applicationId: "com.example.demo",
          addons: [],
          components: [],
        }) + "\n",
      );
      const result = addComponent({ name: "button", projectRoot: root });
      expect(result.path).toBe("components/ui/Button.tsx");
      expect(readFileSync(join(root, result.path), "utf8")).toContain("accessibilityRole");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
