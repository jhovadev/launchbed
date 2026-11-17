import { describe, expect, test } from "bun:test";
import { materializeProject } from "@launchbed/generator";
import { AddonManifestSchema } from "@launchbed/schema";
import { findAddon, isGeneratable } from "@launchbed/catalog";
import { baseRequest } from "./fixtures";

describe("tooling/scrcpy", () => {
  test("catalog marks the addon as generatable and pins the verified mise backend", () => {
    const addon = findAddon("tooling/scrcpy");
    expect(addon).toBeDefined();
    expect(isGeneratable(addon!)).toBe(true);
    expect(addon!.tooling.tools).toEqual([{ name: "github:Genymobile/scrcpy", version: "5.0.1" }]);
  });

  test("accepts a mise GitHub backend id in the tooling schema", () => {
    const parsed = AddonManifestSchema.parse({
      ...findAddon("tooling/scrcpy"),
    });
    expect(parsed.tooling.tools[0]?.name).toBe("github:Genymobile/scrcpy");
  });

  test("quotes the backend id in mise.toml and does not add it to a minimal project", async () => {
    const withAddon = await materializeProject(baseRequest({ addons: ["tooling/scrcpy"] }));
    const mise = new TextDecoder().decode(withAddon.files.get("mise.toml")!);
    expect(mise).toContain('"github:Genymobile/scrcpy" = "5.0.1"');
    const justfile = new TextDecoder().decode(withAddon.files.get("justfile")!);
    expect(justfile).toMatch(/^mirror \*args:/m);
    expect(justfile).toMatch(/^mirror-wifi \*args:/m);
    expect(justfile).toMatch(/^record \*args:/m);
    expect(justfile).toMatch(/^screenshot \*args:/m);
    expect(justfile).toMatch(/^clear-data:/m);
    expect(justfile).toMatch(/^uninstall:/m);
    expect(justfile).toMatch(/^deeplink \*args:/m);
    expect(justfile).toContain("set positional-arguments");
    expect(justfile).toMatch(/^logcat:/m);
    expect(withAddon.files.has("docs/SCRCPY.md")).toBe(true);


    const minimal = await materializeProject(baseRequest());
    const minimalMise = new TextDecoder().decode(minimal.files.get("mise.toml")!);
    expect(minimalMise).not.toContain("scrcpy");
    const minimalJust = new TextDecoder().decode(minimal.files.get("justfile")!);
    expect(minimalJust).toMatch(/^mirror \*args:/m);
  });

  test("app-starter and compose-starter include the scrcpy pin", async () => {
    for (const preset of ["app-starter", "compose-starter"] as const) {
      const project = await materializeProject(baseRequest({ preset }));
      const mise = new TextDecoder().decode(project.files.get("mise.toml")!);
      expect(mise).toContain('"github:Genymobile/scrcpy" = "5.0.1"');
    }
  });
});
