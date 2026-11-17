import { LaunchbedError } from "@launchbed/schema";
import { parse } from "smol-toml";

export { parse as parseToml } from "smol-toml";

export interface CatalogEntry {
  alias: string;
  module?: string;
  pluginId?: string;
  versionRef?: string;
  version?: string;
  addon: string;
}

type TomlValue = string | number | boolean | TomlValue[] | { [key: string]: TomlValue };
type TomlTable = Record<string, TomlValue>;

function fail(message: string): never {
  throw new LaunchbedError("RESOLUTION_ERROR", message);
}

function formatKey(key: string): string {
  return /^[A-Za-z0-9_-]+$/.test(key) ? key : JSON.stringify(key);
}

function formatValue(value: TomlValue): string {
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `[${value.map(formatValue).join(", ")}]`;
  const entries = Object.keys(value)
    .sort()
    .map((key) => `${formatKey(key)} = ${formatValue(value[key]!)}`);
  return `{ ${entries.join(", ")} }`;
}

/** Canonical serialization: stable section and key ordering. */
export function serializeCatalog(table: TomlTable): string {
  const preferred = ["versions", "libraries", "plugins", "bundles"];
  const names = [
    ...preferred.filter((name) => table[name] !== undefined),
    ...Object.keys(table).filter((name) => !preferred.includes(name)).sort(),
  ];
  const parts: string[] = [];
  for (const name of names) {
    const value = table[name]!;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      fail(`Version catalog section "${name}" must be a table.`);
    }
    const lines = [`[${formatKey(name)}]`];
    for (const key of Object.keys(value).sort()) {
      lines.push(`${formatKey(key)} = ${formatValue(value[key]!)}`);
    }
    parts.push(`${lines.join("\n")}\n`);
  }
  return parts.join("\n");
}

function tableOf(table: TomlTable, name: string): TomlTable {
  const value = table[name];
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(`Version catalog section "${name}" must be a table.`);
  }
  return value as TomlTable;
}

/** Applies trusted catalog entries, rejecting alias conflicts and stale refs. */
export function mergeVersionCatalog(source: string, entries: readonly CatalogEntry[]): string {
  let parsed: TomlTable;
  try {
    parsed = JSON.parse(JSON.stringify(parse(source))) as TomlTable;
  } catch (error) {
    fail(`Embedded version catalog is not valid TOML: ${(error as Error).message}`);
  }

  const versions = tableOf(parsed, "versions");
  const libraries = tableOf(parsed, "libraries");
  const plugins = tableOf(parsed, "plugins");
  const applied: CatalogEntry[] = [];

  for (const entry of entries) {
    const hasLibrary = entry.module !== undefined;
    const hasPlugin = entry.pluginId !== undefined;
    const hasVersionOnly = !hasLibrary && !hasPlugin;

    if (hasVersionOnly) {
      if (entry.version === undefined) fail(`Version-only entry ${entry.alias} requires version.`);
      if (versions[entry.alias] !== undefined && versions[entry.alias] !== entry.version) {
        fail(`Version alias "${entry.alias}" from ${entry.addon} conflicts with the existing value.`);
      }
      versions[entry.alias] = entry.version;
      applied.push(entry);
      continue;
    }

    const section = hasPlugin ? plugins : libraries;
    const existing = section[entry.alias];
    const wantedVersion = entry.versionRef ?? entry.version;
    const hasVersion = entry.versionRef !== undefined || entry.version !== undefined;

    if (existing !== undefined) {
      const current = existing as { id?: string; module?: string; version?: { ref?: string } | string };
      const currentVersion =
        typeof current.version === "string" ? current.version : current.version?.ref;
      const currentCoordinate = hasPlugin ? current.id : current.module;
      const wantedCoordinate = hasPlugin ? entry.pluginId : entry.module;
      if (currentCoordinate !== wantedCoordinate || currentVersion !== wantedVersion) {
        fail(
          `Catalog alias "${entry.alias}" from ${entry.addon} conflicts with the existing definition.`,
        );
      }
      applied.push(entry);
      continue;
    }

    if (entry.version !== undefined) {
      if (versions[entry.alias] !== undefined && versions[entry.alias] !== entry.version) {
        fail(`Version alias "${entry.alias}" from ${entry.addon} conflicts with the existing value.`);
      }
      versions[entry.alias] = entry.version;
    }
    if (hasPlugin) {
      const pluginEntry: TomlTable = { id: entry.pluginId! };
      if (hasVersion) {
        pluginEntry.version = entry.versionRef ? { ref: entry.versionRef } : { ref: entry.alias };
      }
      section[entry.alias] = pluginEntry;
    } else if (hasLibrary) {
      const libraryEntry: TomlTable = { module: entry.module! };
      if (hasVersion) {
        libraryEntry.version = entry.versionRef ? { ref: entry.versionRef } : { ref: entry.alias };
      }
      section[entry.alias] = libraryEntry;
    }
    applied.push(entry);
  }

  const usedRefs = new Set(
    applied.filter((entry) => entry.versionRef).map((entry) => entry.versionRef!),
  );
  for (const ref of usedRefs) {
    if (versions[ref] === undefined) {
      fail(`Version reference "${ref}" is not defined in the catalog.`);
    }
  }
  return serializeCatalog(parsed);
}
