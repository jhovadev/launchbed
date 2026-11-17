import {
  LaunchbedError,
  type AddonManifest,
  type PlannedOperation,
  SLOT_FILE,
  type SlotId,
} from "@launchbed/schema";
import { renderText, type TemplateVars } from "./render";
import { insertIntoSlot, validateSlotLayout } from "./slots";
import { mergeVersionCatalog, type CatalogEntry } from "./version-catalog";
import { FRAGMENT_FILES } from "./templates.generated";

const PROTECTED_PATHS = new Set([
  "settings.gradle.kts",
  "build.gradle.kts",
  "app/build.gradle.kts",
  "gradle.properties",
  "gradle/libs.versions.toml",
  "gradle/wrapper/gradle-wrapper.jar",
  "gradle/wrapper/gradle-wrapper.properties",
  "gradlew",
  "gradlew.bat",
  "local.properties",
]);

function fragmentFor(
  template: string,
  addon: string,
  vars: TemplateVars,
  fragments: Readonly<Record<string, string>>,
): string {
  const fragment = fragments[`${template}.txt`];
  if (fragment === undefined) {
    throw new LaunchbedError(
      "TEMPLATE_ERROR",
      `Addon ${addon} references missing local fragment "${template}".`,
    );
  }
  return renderText(fragment, vars, `${addon} fragment ${template}`);
}

function linesOf(content: string): string[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  if (lines.length === 0) {
    throw new LaunchbedError("TEMPLATE_ERROR", "An addon fragment rendered to empty content.");
  }
  return lines;
}

export interface CompositionResult {
  operations: PlannedOperation[];
}

export function applyComposition(
  addons: readonly AddonManifest[],
  files: Map<string, Uint8Array>,
  origins: Map<string, "template" | "generated" | "addon" | "overlay" | "overlay">,
  vars: TemplateVars,
  fragments: Readonly<Record<string, string>> = FRAGMENT_FILES,
): CompositionResult {
  validateSlotLayout(files);
  const operations: PlannedOperation[] = [];
  const slotContributions = new Map<SlotId, { addon: string; index: number; lines: string[]; path: string }[]>();
  const catalogEntries = new Map<string, CatalogEntry>();
  function entryKey(entry: CatalogEntry): string {
    const kind = entry.pluginId ? "plugin" : entry.module ? "library" : "version";
    return `${entry.alias}:${kind}`;
  }
  const gradleLines = new Map<string, { addon: string; line: string }>();
  const seenGradle = new Set<string>();
  const encoder = new TextEncoder();

  for (const addon of addons) {
    addon.fileOperations.forEach((operation, index) => {
      if (operation.type === "add") {
        const addPath = renderText(operation.path, vars, `${addon.id} add path`);
        if (PROTECTED_PATHS.has(addPath)) {
          throw new LaunchbedError(
            "RESOLUTION_ERROR",
            `Addon ${addon.id} cannot add the protected file ${addPath}.`,
          );
        }
        if (files.has(addPath)) {
          throw new LaunchbedError("RESOLUTION_ERROR", `Addon ${addon.id} would overwrite ${addPath}.`);
        }
        const content = encoder.encode(fragmentFor(operation.template, addon.id, vars, fragments));
        files.set(addPath, content);
        origins.set(addPath, "addon");
        operations.push({ addon: addon.id, type: "add", path: addPath });
        return;
      }
      if (operation.type === "modify") {
        throw new LaunchbedError(
          "TEMPLATE_ERROR",
          `Addon ${addon.id} uses "modify", which is rejected in F1.0. Use insert or merge.`,
        );
      }
      if (operation.type === "append") {
        throw new LaunchbedError(
          "TEMPLATE_ERROR",
          `Addon ${addon.id} uses legacy "append". Use insert with a declared slot.`,
        );
      }
      if (operation.type === "insert") {
        const slot = operation.slot as SlotId;
        const insertPath = renderText(operation.path, vars, `${addon.id} insert path`);
        const contribution = {
          addon: addon.id,
          index,
          lines: linesOf(fragmentFor(operation.template, addon.id, vars, fragments)),
          path: insertPath,
        };
        slotContributions.set(slot, [...(slotContributions.get(slot) ?? []), contribution]);
        operations.push({
          addon: addon.id, type: "insert", path: insertPath, slot,
        });
        return;
      }
      // merge
      if (operation.target === "version-catalog") {
        const entry: CatalogEntry = {
          alias: operation.alias,
          module: operation.module,
          pluginId: operation.pluginId,
          versionRef: operation.versionRef,
          version: operation.version,
          addon: addon.id,
        };
        const existing = catalogEntries.get(entryKey(entry));
        if (existing) {
          if (
            existing.module !== entry.module ||
            existing.versionRef !== entry.versionRef ||
            existing.version !== entry.version
          ) {
            throw new LaunchbedError(
              "RESOLUTION_ERROR",
              `Addons ${existing.addon} and ${addon.id} define alias "${entry.alias}" with incompatible values.`,
            );
          }
        } else {
          catalogEntries.set(entryKey(entry), entry);
        }
        operations.push({
          addon: addon.id, type: "merge", target: "version-catalog",
          path: "gradle/libs.versions.toml", alias: entry.alias,
        });
        return;
      }

      let slot: SlotId;
      let line: string;
      const alias = operation.target === "settings-includes" ? undefined : operation.alias;
      if (operation.target === "settings-includes") {
        slot = "settings-includes";
        line = `include("${operation.module}")`;
      } else {
        slot = operation.target;
        line =
          operation.target === "app-dependencies"
            ? `    implementation(libs.${operation.alias!})`
            : operation.target === "app-plugins"
              ? `    alias(libs.plugins.${operation.alias!})`
              : `    alias(libs.plugins.${operation.alias!}) apply false`;
      }
      if (!seenGradle.has(line)) {
        seenGradle.add(line);
        slotContributions.set(slot, [
          ...(slotContributions.get(slot) ?? []),
          { addon: addon.id, index, lines: [line], path: SLOT_FILE[slot]! },
        ]);
        operations.push({
          addon: addon.id, type: "merge", target: operation.target,
          path: SLOT_FILE[slot]!, slot,
          ...(alias === undefined ? {} : { alias }),
        });
      }
    });
  }

  for (const [slot, contributions] of [...slotContributions.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const ordered = [...contributions].sort(
      (a, b) => (a.addon < b.addon ? -1 : a.addon > b.addon ? 1 : a.index - b.index),
    );
    const seenContributions = new Set<string>();
    const seenImports = new Set<string>();
    const seenDependencyLines = new Set<string>();
    const lines: string[] = [];
    for (const contribution of ordered) {
      const key = contribution.lines.join("\\n");
      if (seenContributions.has(key)) continue;
      seenContributions.add(key);
      for (const line of contribution.lines) {
        if (line.trim().startsWith("import ") && seenImports.has(line.trim())) continue;
        if (line.trim().startsWith("import ")) seenImports.add(line.trim());
        if (slot === "app-dependencies" &&
            /^(androidTestImplementation|debugImplementation|testImplementation)\(/.test(line.trim())) {
          if (seenDependencyLines.has(line.trim())) continue;
          seenDependencyLines.add(line.trim());
        }
        lines.push(line);
      }
    }
    const path = ordered[0]!.path;
    insertIntoSlot(files, path, slot, lines);
  }

  if (catalogEntries.size > 0) {
    const path = "gradle/libs.versions.toml";
    const data = files.get(path);
    if (!data) {
      throw new LaunchbedError("TEMPLATE_ERROR", `Required template file is missing: ${path}`);
    }
    const merged = mergeVersionCatalog(new TextDecoder().decode(data), [...catalogEntries.values()]);
    files.set(path, encoder.encode(merged));
    origins.set(path, "addon");
  }

  operations.sort((a, b) =>
    `${a.addon}|${a.type}|${a.path}|${a.alias ?? ""}`.localeCompare(
      `${b.addon}|${b.type}|${b.path}|${b.alias ?? ""}`,
    ),
  );
  return { operations };
}
