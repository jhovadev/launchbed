import {
  LaunchbedError,
  type AddonManifest,
  type JustRecipe,
  type MiseTool,
} from "@launchbed/schema";
import { GENERATED_MISE, RESERVED_JUST_RECIPES } from "./versions";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

export const JUST_RECIPE_SLOT = "# @launchbed-slot just-recipes";

export interface MergedTooling {
  tools: Map<string, { version: string; addons: string[] }>;
  env: Map<string, { value: string; addons: string[] }>;
  recipes: Map<string, { recipe: JustRecipe; addons: string[] }>;
}

function canonicalRecipeBody(recipe: JustRecipe): string {
  const deps = recipe.dependencies.length > 0 ? ` ${recipe.dependencies.join(" ")}` : "";
  return `${recipe.name}:${deps}\n${recipe.lines.map((line) => `    ${line}`).join("\n")}`;
}

/**
 * Merges addon mise/just contributions. Conflicts (same tool, different version;
 * same recipe name, different body) are rejected before any file is rewritten.
 */
export function mergeTooling(addons: readonly AddonManifest[]): MergedTooling {
  const tools = new Map<string, { version: string; addons: string[] }>();
  for (const [name, version] of Object.entries(GENERATED_MISE.tools)) {
    tools.set(name, { version, addons: ["(base)"] });
  }
  const env = new Map<string, { value: string; addons: string[] }>();
  const recipes = new Map<string, { recipe: JustRecipe; addons: string[] }>();

  for (const addon of addons) {
    for (const tool of addon.tooling.tools) {
      const existing = tools.get(tool.name);
      if (existing && existing.version !== tool.version) {
        throw new LaunchbedError(
          "RESOLUTION_ERROR",
          `Incompatible mise tool versions for "${tool.name}": ${existing.version} (${existing.addons.join(", ")}) vs ${tool.version} (${addon.id}).`,
          [{ path: "tooling.tools", message: `tool ${tool.name} has conflicting versions` }],
        );
      }
      if (existing) {
        if (!existing.addons.includes(addon.id)) existing.addons.push(addon.id);
      } else {
        tools.set(tool.name, { version: tool.version, addons: [addon.id] });
      }
    }

    for (const entry of addon.tooling.env) {
      const existing = env.get(entry.key);
      if (existing && existing.value !== entry.value) {
        throw new LaunchbedError(
          "RESOLUTION_ERROR",
          `Incompatible mise env values for "${entry.key}" from ${existing.addons.join(", ")} and ${addon.id}.`,
          [{ path: "tooling.env", message: `env ${entry.key} has conflicting values` }],
        );
      }
      if (existing) {
        if (!existing.addons.includes(addon.id)) existing.addons.push(addon.id);
      } else {
        env.set(entry.key, { value: entry.value, addons: [addon.id] });
      }
    }

    for (const recipe of addon.tooling.justRecipes) {
      const reserved = (RESERVED_JUST_RECIPES as readonly string[]).includes(recipe.name);
      const existing = recipes.get(recipe.name);
      if (reserved) {
        throw new LaunchbedError(
          "RESOLUTION_ERROR",
          `Addon ${addon.id} cannot redefine reserved just recipe "${recipe.name}".`,
          [{ path: "tooling.justRecipes", message: `recipe ${recipe.name} is reserved by the base template` }],
        );
      }
      if (existing && canonicalRecipeBody(existing.recipe) !== canonicalRecipeBody(recipe)) {
        throw new LaunchbedError(
          "RESOLUTION_ERROR",
          `Conflicting just recipes named "${recipe.name}" from ${existing.addons.join(", ")} and ${addon.id}.`,
          [{ path: "tooling.justRecipes", message: `recipe ${recipe.name} has conflicting bodies` }],
        );
      }
      if (existing) {
        if (!existing.addons.includes(addon.id)) existing.addons.push(addon.id);
      } else {
        recipes.set(recipe.name, { recipe, addons: [addon.id] });
      }
    }
  }

  return { tools, env, recipes };
}

function tomlKey(name: string): string {
  if (/^[A-Za-z_][A-Za-z0-9_-]*$/.test(name)) return name;
  return `"${name.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

export function serializeMiseToml(merged: MergedTooling): string {
  const lines: string[] = [
    "# Toolchain for the generated Launchbed project.",
    "# The Android SDK itself is installed by `just sdk-setup`, because mise has no",
    "# official Android SDK backend.",
    "# Tool versions are pinned from docs/compatibility.md in the Launchbed repo.",
    "# mise supplies tools and env; just runs complex commands. The [tasks] below",
    "# are shortcuts to just recipes, not a second command catalog.",
    `min_version = "${GENERATED_MISE.minVersion}"`,
    "",
    "[tools]",
  ];
  const toolNames = [...merged.tools.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  for (const name of toolNames) {
    const tool = merged.tools.get(name)!;
    lines.push(`${tomlKey(name)} = "${tool.version}"`);
  }
  lines.push("");
  if (merged.env.size > 0) {
    lines.push("[env]");
    const keys = [...merged.env.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    for (const key of keys) {
      const entry = merged.env.get(key)!;
      lines.push(`${key} = "${entry.value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`);
    }
    lines.push("");
  } else {
    lines.push("# ANDROID_HOME and ANDROID_SDK_ROOT stay on the machine; they are not written here.");
    lines.push("");
  }
  for (const name of GENERATED_MISE.shortcuts) {
    lines.push(`[tasks.${name}]`);
    lines.push(`description = "Shortcut to just ${name}. mise supplies the toolchain."`);
    lines.push(`run = "just ${name}"`);
    lines.push("");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

function renderAddonRecipes(merged: MergedTooling): string {
  const names = [...merged.recipes.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  if (names.length === 0) return "";
  const blocks: string[] = [];
  for (const name of names) {
    const { recipe, addons } = merged.recipes.get(name)!;
    const contrib = [...addons].sort().join(", ");
    const deps = recipe.dependencies.length > 0 ? ` ${recipe.dependencies.join(" ")}` : "";
    const body = recipe.lines.map((line) => `    ${line}`).join("\n");
    blocks.push(`# ${recipe.description}\n# Contributed by ${contrib}.\n${recipe.name}:${deps}\n${body}`);
  }
  return `\n${blocks.join("\n\n")}\n`;
}

export function applyTooling(files: Map<string, Uint8Array>, addons: readonly AddonManifest[]): MergedTooling {
  const merged = mergeTooling(addons);
  files.set("mise.toml", encoder.encode(serializeMiseToml(merged)));

  const justPath = "justfile";
  const current = files.get(justPath);
  if (!current) {
    throw new LaunchbedError("TEMPLATE_ERROR", "Required template file is missing: justfile");
  }
  const text = decoder.decode(current);
  const lines = text.split("\n");
  const index = lines.findIndex((line) => line.trim() === JUST_RECIPE_SLOT);
  if (index < 0) {
    throw new LaunchbedError(
      "TEMPLATE_ERROR",
      `Template slot "just-recipes" must appear exactly once in justfile.`,
    );
  }
  const count = lines.filter((line) => line.trim() === JUST_RECIPE_SLOT).length;
  if (count !== 1) {
    throw new LaunchbedError(
      "TEMPLATE_ERROR",
      `Template slot "just-recipes" must appear exactly once in justfile (found ${count}).`,
    );
  }
  const branded = lines
    .map((line) =>
      line.includes("Generated by Launchbed")
        ? "# Generated by Launchbed. Run `just --list` for all tasks."
        : line,
    )
    .join("\n");
  const brandedLines = branded.split("\n");
  const slotIndex = brandedLines.findIndex((line) => line.trim() === JUST_RECIPE_SLOT);
  const insertion = renderAddonRecipes(merged);
  if (insertion) {
    brandedLines.splice(slotIndex, 0, insertion.trimEnd(), "");
  }
  files.set(justPath, encoder.encode(brandedLines.join("\n")));
  return merged;
}
