import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { OVERLAY_README, createPlan, generateProject, readZip, verifyZipAgainstPlan } from "@launchbed/generator";
import { delegateDirectory, delegateSetupCommands, formatDelegateStep, overlayZipFileName } from "@launchbed/schema";
import { baseRequest } from "./fixtures";

const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

describe("overlay-only ZIP for delegated targets", () => {
  for (const target of ["expo", "flutter"] as const) {
    test(`${target}: deterministic, matches the plan and carries setup notes`, async () => {
      const request = baseRequest({ target, preset: "app-starter" });
      const first = await generateProject(request);
      const second = await generateProject(request);
      expect(sha(first.zip)).toBe(sha(second.zip));
      expect(first.fileName).toBe("demo-app-launchbed-overlay.zip");
      expect(() => verifyZipAgainstPlan(first.zip, first.plan)).not.toThrow();
      const plan = await createPlan(request);
      expect(plan.files.map((file) => [file.path, file.sha256])).toEqual(first.plan.files.map((file) => [file.path, file.sha256]));
      const entries = readZip(first.zip);
      expect(entries.length).toBe(plan.totals.files);
      const readme = new TextDecoder().decode(entries.find((entry) => entry.path === OVERLAY_README)!.data);
      const step = plan.steps[0]!;
      expect(readme).toContain(formatDelegateStep(step));
      expect(readme).toContain(`unzip -o ../demo-app-launchbed-overlay.zip`);
      expect(readme).toContain(`launchbed new --name 'Demo App' --app-id com.example.demo --target ${target} --preset app-starter`);
      // Overlays only: nothing from the official template is re-hosted.
      for (const official of target === "expo" ? ["package.json", "app.json", "tsconfig.json"] : ["pubspec.yaml", "android/app/build.gradle.kts"]) {
        expect(entries.some((entry) => entry.path === official)).toBe(false);
      }
    });
  }

  test("manual setup lines: official command, cd into its directory, unzip", async () => {
    const expo = (await createPlan(baseRequest({ target: "expo" }))).steps[0]!;
    expect(delegateDirectory(expo)).toBe("demo-app");
    expect(delegateSetupCommands({ target: "expo", step: expo, zipFileName: overlayZipFileName("Demo App") })).toEqual([
      formatDelegateStep(expo),
      "cd demo-app",
      "unzip -o ../demo-app-launchbed-overlay.zip",
    ]);
    const flutter = (await createPlan(baseRequest({ target: "flutter" }))).steps[0]!;
    expect(delegateDirectory(flutter)).toBe("demo_app");
    expect(delegateSetupCommands({ target: "flutter", step: flutter, zipFileName: "x.zip" }).at(-1)).toBe("flutter pub get");
    expect(formatDelegateStep(expo)).toStartWith("npx --yes create-expo-app@");
  });

  test("Compose keeps its full-project ZIP name", async () => {
    const project = await generateProject(baseRequest({}));
    expect(project.fileName).toBe("demo-app.zip");
    expect(project.plan.steps).toEqual([]);
  });
});
