import { describe, expect, test } from "bun:test";
import { parseToml as parse } from "@launchbed/generator";
import { generateProject, materializeProject, parseToml } from "@launchbed/generator";
import { LaunchbedError } from "@launchbed/schema";
import { buildCatalog } from "@launchbed/catalog";
import { baseRequest } from "./fixtures";

const roomRequest = baseRequest({
  projectName: "Room Demo",
  applicationId: "com.example.roomdemo",
  namespace: "com.example.roomdemo",
  packageName: "com.example.roomdemo",
  addons: ["storage/room"],
});

describe("storage/room addon", () => {
  test("catalog announces room as beta and generatable", () => {
    const room = buildCatalog().addons.find((addon) => addon.id === "storage/room");
    expect(room?.status).toBe("beta");
    expect(room?.generatable).toBe(true);
    const project = materializeProject(roomRequest);
    expect(project.plan.request.addons).toEqual(["storage/room"]);
  });

  test("resolver accepts room and rejects incompatible minSdk", () => {
    expect(() => baseRequest({ addons: ["storage/room"], minSdk: 23 })).toThrow();
    expect(() => materializeProject(baseRequest({ addons: ["storage/room", "storage/sqlite-direct"] }))).toThrow(
      LaunchbedError,
    );
  });

  test("generates exactly the room files", () => {
    const sameBase = baseRequest({
      projectName: "Room Demo",
      applicationId: "com.example.roomdemo",
      namespace: "com.example.roomdemo",
      packageName: "com.example.roomdemo",
    });
    const minimal = materializeProject(sameBase);
    const room = materializeProject(roomRequest);
    const added = room.plan.files.map((file) => file.path).filter((path) => !minimal.plan.files.map((f) => f.path).includes(path));
    expect(added.sort()).toEqual([
      "app/schemas/com/example/roomdemo/data/local/AppDatabase/1.json",
      "app/src/androidTest/java/com/example/roomdemo/data/local/NoteDaoTest.kt",
      "app/src/main/java/com/example/roomdemo/data/local/AppDatabase.kt",
      "app/src/main/java/com/example/roomdemo/data/local/DatabaseProvider.kt",
      "app/src/main/java/com/example/roomdemo/data/local/NoteDao.kt",
      "app/src/main/java/com/example/roomdemo/data/local/NoteEntity.kt",
      "app/src/main/java/com/example/roomdemo/data/repository/NoteRepository.kt",
      "app/src/test/java/com/example/roomdemo/data/local/NoteEntityTest.kt",
    ]);
    expect(room.plan.totals.files).toBe(minimal.plan.totals.files + 8);
  });
});
describe("room gradle integration", () => {
  const project = materializeProject(roomRequest);
  const build = new TextDecoder().decode(project.files.get("app/build.gradle.kts")!);
  const catalogText = new TextDecoder().decode(project.files.get("gradle/libs.versions.toml")!);
  const catalog = parse(catalogText) as any;

  test("applies ksp and room plugins only through the addon", () => {
    expect(build).toContain("alias(libs.plugins.ksp)");
    expect(build).toContain("alias(libs.plugins.room)");
    expect(build).toContain("ksp(libs.roomcompiler)");
    expect(build).toContain("implementation(libs.roomruntime)");
    expect(build).toContain('schemaDirectory("$projectDir/schemas")');
    expect(build).not.toContain("kapt");
    expect(build).not.toContain("room-ktx");
    expect(build).not.toContain("kapt");
  });

  test("version catalog has no duplicate aliases and correct versions", () => {
    expect(catalog.versions.room).toBe("2.8.5");
    expect(catalog.versions.ksp).toBe("2.3.10");
    expect(catalog.libraries.roomruntime.module).toBe("androidx.room:room-runtime");
    expect(catalog.libraries.roomcompiler.module).toBe("androidx.room:room-compiler");
    expect(catalog.plugins.ksp.id).toBe("com.google.devtools.ksp");
    expect(catalog.plugins.room.id).toBe("androidx.room");
    const aliases = Object.keys(catalog.libraries);
    expect(new Set(aliases).size).toBe(aliases.length);
  });

  test("generated Kotlin uses the configured namespace", () => {
    const db = new TextDecoder().decode(
      project.files.get("app/src/main/java/com/example/roomdemo/data/local/AppDatabase.kt")!,
    );
    expect(db).toContain("package com.example.roomdemo.data.local");
    const entity = new TextDecoder().decode(
      project.files.get("app/src/main/java/com/example/roomdemo/data/local/NoteEntity.kt")!,
    );
    expect(entity).toContain("@Entity(tableName = \"notes\")");
    const repository = new TextDecoder().decode(
      project.files.get("app/src/main/java/com/example/roomdemo/data/repository/NoteRepository.kt")!,
    );
    expect(repository).toContain("import com.example.roomdemo.data.local.NoteDao");
  });
});

describe("room determinism and parity", () => {
  test("zip is byte-identical across runs", () => {
    const first = generateProject(roomRequest);
    const second = generateProject(baseRequest({
      projectName: "Room Demo",
      applicationId: "com.example.roomdemo",
      namespace: "com.example.roomdemo",
      packageName: "com.example.roomdemo",
      addons: ["storage/room"],
    }));
    expect(Buffer.from(first.zip).equals(Buffer.from(second.zip))).toBe(true);
  });

  test("minimal project has no room artifacts", () => {
    const minimal = materializeProject(baseRequest());
    const paths = minimal.plan.files.map((file) => file.path);
    expect(paths.some((path) => path.includes("Room") || path.includes("room"))).toBe(false);
    expect(paths).not.toContain("app/schemas/com/example/demo/data/local/AppDatabase/1.json");
    expect(minimal.plan.operations).toEqual([]);
  });

  test("custom namespace changes generated paths", () => {
    const request = baseRequest({
      projectName: "Room Demo",
      applicationId: "com.acme.mobile",
      namespace: "dev.example.notes",
      packageName: "pe.demo.inventory",
      addons: ["storage/room"],
    });
    const project = materializeProject(request);
    expect(project.plan.files.map((file) => file.path)).toContain(
      "app/src/main/java/pe/demo/inventory/data/local/NoteEntity.kt",
    );
    expect(project.plan.files.map((file) => file.path)).toContain(
      "app/schemas/pe/demo/inventory/data/local/AppDatabase/1.json",
    );
    const entity = new TextDecoder().decode(
      project.files.get("app/src/main/java/pe/demo/inventory/data/local/NoteEntity.kt")!,
    );
    expect(entity).toContain("package pe.demo.inventory.data.local");
  });
});
