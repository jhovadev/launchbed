import { describe, expect, test } from "bun:test";
import { generateProject, materializeProject } from "@launchbed/generator";
import { baseRequest } from "./fixtures";

function text(files: Map<string, Uint8Array>, path: string): string {
  return new TextDecoder().decode(files.get(path)!);
}

describe("ui/notes addon", () => {
  test("resolves room and navigation automatically", () => {
    const project = materializeProject(baseRequest({ addons: ["ui/notes"] }));
    expect(project.plan.request.addons).toEqual(["storage/room", "ui/navigation", "ui/notes"]);
  });

  test("generates reactive note files and navigation registration", () => {
    const project = materializeProject(baseRequest({ addons: ["ui/notes"] }));
    const paths = project.plan.files.map((file) => file.path);
    expect(paths).toContain("app/src/main/java/com/example/demo/feature/notes/NotesViewModel.kt");
    expect(paths).toContain("app/src/main/java/com/example/demo/feature/notes/NotesScreen.kt");
    expect(paths).toContain("app/src/main/java/com/example/demo/feature/notes/NoteEditorScreen.kt");
    const appRoot = text(project.files, "app/src/main/java/com/example/demo/ui/navigation/AppRoot.kt");
    expect(appRoot).toContain("entry<AppRoute.Notes>");
    expect(appRoot).toContain("entry<AppRoute.NoteEditor>");
  });

  test("adds lifecycle dependencies without duplicates", () => {
    const project = materializeProject(baseRequest({ addons: ["ui/notes"] }));
    const build = text(project.files, "app/build.gradle.kts");
    expect(build).toContain("implementation(libs.lifecycleviewmodelcompose)");
    expect(build).toContain("implementation(libs.lifecycleruntimecompose)");
    expect(build.split("implementation(libs.lifecycleviewmodelcompose)").length - 1).toBe(1);
  });

  test("minimal project has no notes artifacts", () => {
    const minimal = materializeProject(baseRequest());
    const paths = minimal.plan.files.map((file) => file.path);
    expect(paths.some((path) => path.includes("feature/notes"))).toBe(false);
    expect(minimal.plan.operations).toEqual([]);
  });

  test("zip is deterministic", () => {
    const first = generateProject(baseRequest({ addons: ["ui/notes"] }));
    const second = generateProject(baseRequest({ addons: ["ui/notes"] }));
    expect(Buffer.from(first.zip).equals(Buffer.from(second.zip))).toBe(true);
  });
});
