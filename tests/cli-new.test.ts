import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test } from "bun:test";
import { formatNewCommand } from "@launchbed/generator";
import { parseArgs } from "../packages/cli/src/args";
import { requestFromNewOptions, resolveNewOptions, slugToApplicationId, writeGeneratedProject } from "../packages/cli/src/new-command";

describe("launchbed new", () => {
  test("parses repeatable addons and new flags", () => {
    const args = parseArgs([
      "new",
      "--name",
      "Demo App",
      "--app-id",
      "com.example.demo",
      "--preset",
      "compose-minimal",
      "--addon",
      "ui/settings",
      "--addon",
      "storage/room",
      "--out",
      "demo-app",
      "--yes",
      "--force",
    ]);
    expect(args.command).toBe("new");
    expect(args.values.get("name")).toBe("Demo App");
    expect(args.values.get("app-id")).toBe("com.example.demo");
    expect(args.lists.get("addon")).toEqual(["ui/settings", "storage/room"]);
    expect(args.flags.has("yes")).toBe(true);
    expect(args.flags.has("force")).toBe(true);
  });

  test("formats an equivalent CLI command", () => {
    expect(
      formatNewCommand({
        projectName: "Demo App",
        applicationId: "com.example.demo",
        preset: "compose-minimal",
        addons: ["storage/room", "ui/notes"],
        out: "demo-app",
      }),
    ).toBe(
      "launchbed new --name 'Demo App' --app-id com.example.demo --preset compose-minimal --addon storage/room --addon ui/notes --out demo-app",
    );
  });

  test("--yes uses documented defaults and writes a directory plus ZIP", async () => {
    const root = mkdtempSync(join(tmpdir(), "launchbed-new-"));
    try {
      const args = parseArgs(["new", "--yes", "--out", join(root, "demo-app")]);
      const options = await resolveNewOptions(args, false);
      expect(options.projectName).toBe("Demo App");
      expect(options.applicationId).toBe(slugToApplicationId("Demo App"));
      expect(options.preset).toBe("compose-minimal");
      const result = await writeGeneratedProject(options);
      expect(existsSync(join(result.directory, "mise.toml"))).toBe(true);
      expect(existsSync(join(result.directory, "justfile"))).toBe(true);
      expect(existsSync(join(result.directory, "gradlew"))).toBe(true);
      expect(existsSync(result.zipPath)).toBe(true);
      expect(result.command).toContain("launchbed new");
      expect(result.files).toBeGreaterThan(30);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("rejects a planned preset", () => {
    expect(() =>
      requestFromNewOptions({
        projectName: "X",
        applicationId: "com.example.x",
        preset: "media-player",
        addons: [],
        outDir: "x",
        force: false,
      }),
    ).toThrow(/cannot be generated/);
  });
});
