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
    expect(names).toEqual([
      "app-bar",
      "avatar",
      "badge",
      "button",
      "card",
      "dialog",
      "list-item",
      "snackbar",
      "switch",
      "text-field",
    ]);
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

describe("overlay and chrome components (Dialog, Avatar, Snackbar, AppBar)", () => {
  const added = ["app-bar", "avatar", "dialog", "snackbar"] as const;

  test("every required prop appears in every supported platform source", async () => {
    const { componentSources } = await import("@launchbed/generator");
    const catalog = loadComponentCatalog();
    for (const name of added) {
      const contract = catalog.components.find((component) => component.name === name);
      expect(contract).toBeDefined();
      expect(contract!.a11y.length).toBeGreaterThan(20);
      for (const target of ["android-compose", "expo", "flutter"] as const) {
        const entry = contract!.targets[target];
        expect(entry?.status).toBe("supported");
        const file = componentSources(contract!).find((source) => source.target === target);
        expect(file).toBeDefined();
        const required = (contract!.props as Array<{ name: string; required: boolean }>).filter((prop) => prop.required);
        for (const prop of required) {
          // Flutter dialogs return a Future<bool> instead of taking callbacks.
          if (target === "flutter" && name === "dialog" && prop.name.startsWith("on")) continue;
          expect(file!.content).toContain(prop.name);
        }
      }
    }
  });

  test("platform sources use the native primitive and accessible naming", async () => {
    const { componentSources } = await import("@launchbed/generator");
    const catalog = loadComponentCatalog();
    const source = (name: string, target: string) =>
      componentSources(catalog.components.find((component) => component.name === name)!).find(
        (file) => file.target === target,
      )!.content;
    expect(source("dialog", "android-compose")).toContain("AlertDialog(");
    expect(source("dialog", "expo")).toContain("accessibilityViewIsModal");
    expect(source("dialog", "flutter")).toContain("showDialog<bool>");
    expect(source("snackbar", "android-compose")).toContain("LiveRegionMode.Polite");
    expect(source("snackbar", "expo")).toContain('accessibilityLiveRegion="polite"');
    expect(source("snackbar", "flutter")).toContain("ScaffoldMessenger.of(context)");
    expect(source("avatar", "android-compose")).toContain("contentDescription = label");
    expect(source("avatar", "expo")).toContain('accessibilityRole="image"');
    expect(source("avatar", "flutter")).toContain("Semantics(");
    expect(source("app-bar", "android-compose")).toContain('contentDescription = "Navigate back"');
    expect(source("app-bar", "android-compose")).not.toContain("material.icons");
    expect(source("app-bar", "expo")).toContain('accessibilityLabel="Navigate back"');
    expect(source("app-bar", "flutter")).toContain("implements PreferredSizeWidget");
  });

  test("launchbed add writes each new component for all three targets", () => {
    for (const target of ["android-compose", "expo", "flutter"] as const) {
      const root = mkdtempSync(join(tmpdir(), `launchbed-add-${target}-`));
      try {
        writeFileSync(
          join(root, "launchbed.json"),
          JSON.stringify({
            schemaVersion: 1,
            target,
            projectName: "Demo",
            applicationId: "com.example.demo",
            packageName: "com.example.demo",
            addons: [],
            components: [],
          }) + "\n",
        );
        for (const name of added) {
          const result = addComponent({ name, projectRoot: root });
          expect(result.wrote).toBe(true);
          const written = readFileSync(join(root, result.path), "utf8");
          expect(written).not.toMatch(/\{\{package(Name|Path)\}\}/);
          if (target === "android-compose") expect(written).toContain("package com.example.demo.ui.components");
        }
        const config = JSON.parse(readFileSync(join(root, "launchbed.json"), "utf8"));
        expect(config.components).toEqual([...added]);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  });
});

describe("embedded component registry (Node SSR / Vercel safe)", () => {
  test("embedded registry matches registry/components on disk", async () => {
    const { registryRoot, registrySource } = await import("@launchbed/generator");
    const { readdirSync, statSync } = await import("node:fs");
    const root = registryRoot();
    const walk = (dir: string, base = ""): string[] =>
      readdirSync(dir).sort().flatMap((name) => {
        const rel = base ? `${base}/${name}` : name;
        return statSync(join(dir, name)).isDirectory() ? walk(join(dir, name), rel) : [rel];
      });
    const files = walk(root);
    expect(files.length).toBeGreaterThanOrEqual(24);
    for (const file of files) {
      expect(registrySource(file)).toBe(readFileSync(join(root, file), "utf8").replace(/\r\n/g, "\n"));
    }
  });

  test("default catalog is the embedded one and equals the disk catalog", async () => {
    const { registryRoot } = await import("@launchbed/generator");
    expect(loadComponentCatalog()).toEqual(loadComponentCatalog(registryRoot()));
  });

  test("componentSources returns one file per supported target", async () => {
    const { componentSources } = await import("@launchbed/generator");
    for (const component of loadComponentCatalog().components) {
      const supported = Object.values(component.targets).filter((entry) => entry.status === "supported").length;
      const sources = componentSources(component);
      expect(sources.length).toBe(supported);
      for (const source of sources) expect(source.content.length).toBeGreaterThan(50);
    }
  });

  test("runtime code never depends on Bun-only import.meta.dir", () => {
    const source = readFileSync(join(import.meta.dir, "../packages/generator/src/components.ts"), "utf8");
    expect(source).not.toContain("import.meta.dir");
  });
});
