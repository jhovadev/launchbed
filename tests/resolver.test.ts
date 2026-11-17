import { describe, expect, test } from "bun:test";
import { LaunchbedError } from "@launchbed/schema";
import { resolveAddons } from "@launchbed/resolver";
import { baseRequest, stableAddon } from "./fixtures";

const catalog = [
  stableAddon("storage/alpha"),
  stableAddon("storage/beta", { dependencies: ["tooling/base"], conflicts: ["storage/gamma"] }),
  stableAddon("storage/gamma"),
  stableAddon("tooling/base"),
  stableAddon("ui/onboarding", { dependencies: ["ui/requires-new-sdk"], requirements: { minSdk: 30 } }),
  stableAddon("ui/requires-new-sdk"),
  stableAddon("ui/cycle-a", { dependencies: ["ui/cycle-b"] }),
  stableAddon("ui/cycle-b", { dependencies: ["ui/cycle-a"] }),
  stableAddon("ui/broken", { dependencies: ["ui/missing"] }),
];

function requestWith(addons: string[], minSdk = 26) {
  return baseRequest({ addons, minSdk });
}

describe("resolveAddons", () => {
  test("resolves an empty selection with a warning", () => {
    const result = resolveAddons(requestWith([]), catalog);
    expect(result.addons).toEqual([]);
    expect(result.warnings.length).toBe(1);
  });

  test("pulls transitive dependencies in deterministic order", () => {
    const result = resolveAddons(requestWith(["storage/beta"]), catalog);
    expect(result.addons.map((addon) => addon.id)).toEqual(["storage/beta", "tooling/base"]);
  });

  test("rejects unknown addons", () => {
    expect(() => resolveAddons(requestWith(["storage/nope"]), catalog)).toThrow(LaunchbedError);
  });

  test("rejects conflicts, reporting both ids", () => {
    expect(() => resolveAddons(requestWith(["storage/beta", "storage/gamma"]), catalog)).toThrow(
      /storage\/beta.*storage\/gamma/,
    );
  });

  test("detects dependency cycles", () => {
    expect(() => resolveAddons(requestWith(["ui/cycle-a"]), catalog)).toThrow(/cycle/i);
  });

  test("rejects unknown dependencies", () => {
    expect(() => resolveAddons(requestWith(["ui/broken"]), catalog)).toThrow(/unknown addon/i);
  });

  test("enforces addon minSdk requirements", () => {
    expect(() => resolveAddons(requestWith(["ui/onboarding"], 26), catalog)).toThrow(/minSdk 30/);
    const result = resolveAddons(requestWith(["ui/onboarding"], 30), catalog);
    expect(result.requirements.minSdk).toBe(30);
  });

  test("rejects planned addons instead of pretending to generate them", () => {
    const planned = stableAddon("ui/planned", {
      status: "planned",
      fileOperations: [],
    });
    expect(() => resolveAddons(requestWith(["ui/planned"]), [...catalog, planned])).toThrow(
      /planned and cannot be generated/,
    );
  });

  test("rejects experimental addons", () => {
    const experimental = stableAddon("ui/experimental", { status: "experimental" });
    expect(() => resolveAddons(requestWith(["ui/experimental"]), [...catalog, experimental])).toThrow(
      /experimental and cannot be generated/,
    );
  });

  test("warns about beta addons", () => {
    const beta = stableAddon("ui/beta", { status: "beta" });
    const result = resolveAddons(requestWith(["ui/beta"]), [...catalog, beta]);
    expect(result.warnings.join(" ")).toContain("beta");
  });

  test("rejects duplicate manifest ids", () => {
    const duplicate = stableAddon("storage/alpha");
    expect(() => resolveAddons(requestWith(["storage/alpha"]), [...catalog, duplicate])).toThrow(
      /Duplicate addon manifest/,
    );
  });
});
