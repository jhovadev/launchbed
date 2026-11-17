import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  LaunchbedError,
  projectSlug,
  type ProjectRequestInput,
} from "@launchbed/schema";
import {
  ALL_PRESETS,
  findPreset,
  isPresetGeneratable,
} from "@launchbed/catalog";
import {
  createZip,
  formatNewCommand,
  getCatalog,
  isExecutablePath,
  materializeProject,
  verifyZipAgainstPlan,
  writeProjectTree,
  runDelegateStep,
} from "@launchbed/generator";
import type { Args } from "./args";
import { promptLine, promptList } from "./prompt";

const DEFAULT_NAME = "Demo App";
const DEFAULT_PRESET = "compose-minimal";

export interface NewOptions {
  projectName: string;
  applicationId: string;
  preset?: string;
  addons: string[];
  outDir: string;
  force: boolean;
  target: string;
  /** Imported theme preset id (see launchbed catalog --json). */
  themeId?: string;
}

export function slugToApplicationId(projectName: string): string {
  const slug = projectSlug(projectName).replaceAll("-", "");
  const candidate = slug.length > 0 ? slug : "app";
  const safe = /^[a-z]/.test(candidate) ? candidate : `app${candidate}`;
  return `com.example.${safe}`;
}

export async function resolveNewOptions(args: Args, interactive: boolean): Promise<NewOptions> {
  const force = args.flags.has("force");
  const yes = args.flags.has("yes");
  if (args.positionals.length > 1) {
    throw new Error("launchbed new accepts at most one positional output directory.");
  }
  if (args.positionals.length === 1 && args.values.has("out")) {
    throw new Error("Pass the output directory as a positional argument or as --out, not both.");
  }

  let projectName = args.values.get("name") ?? "";
  let applicationId = args.values.get("app-id") ?? "";
  let preset = args.values.get("preset") ?? "";
  const themeId = args.values.get("theme") || undefined;
  let addons = [...(args.lists.get("addon") ?? [])];
  const target = args.values.get("target") ?? "android-compose";

  if (!yes && interactive) {
    if (!projectName) projectName = await promptLine("Project name", DEFAULT_NAME);
    if (!applicationId) {
      applicationId = await promptLine("Application ID", slugToApplicationId(projectName || DEFAULT_NAME));
    }
    const generatable = ALL_PRESETS.filter(isPresetGeneratable).map((entry) => ({
      id: entry.id,
      label: `${entry.name} (${entry.status})`,
    }));
    if (!preset) {
      preset = await promptList("Preset (id or number, empty for none)", generatable, DEFAULT_PRESET);
    }
    if (addons.length === 0) {
      const catalog = getCatalog();
      const optional = catalog.addons.filter((addon) => addon.generatable);
      console.log("Generatable addons:");
      for (const addon of optional) {
        console.log(`  - ${addon.id}: ${addon.displayName}`);
      }
      const extra = await promptLine("Extra addons (comma-separated ids, empty for none)", "");
      if (extra) {
        addons = extra.split(/[,\s]+/).map((id) => id.trim()).filter(Boolean);
      }
    }
  } else if (!yes && !interactive) {
    throw new Error("launchbed new needs a TTY for prompts, or pass --yes with flags.");
  }

  projectName = projectName || DEFAULT_NAME;
  applicationId = applicationId || slugToApplicationId(projectName);
  if (preset === "") {
    preset = yes && target === "android-compose" ? DEFAULT_PRESET : "";
  }

  const outDir = resolve(args.values.get("out") ?? args.positionals[0] ?? projectSlug(projectName));
  return { projectName, applicationId, preset: preset || undefined, addons, outDir, force, target, ...(themeId ? { themeId } : {}) };
}

export function requestFromNewOptions(options: NewOptions): ProjectRequestInput {
  if (options.preset) {
    const preset = findPreset(options.preset);
    if (!preset) {
      throw new LaunchbedError("INVALID_REQUEST", `Unknown project preset "${options.preset}".`);
    }
    if (!isPresetGeneratable(preset)) {
      throw new LaunchbedError("RESOLUTION_ERROR", `Preset "${preset.id}" is ${preset.status} and cannot be generated yet.`);
    }
  }
  return {
    template: "android-compose-minimal",
    projectName: options.projectName,
    applicationId: options.applicationId,
    namespace: options.applicationId,
    ...(options.preset ? { preset: options.preset } : {}),
    ...(options.themeId ? { themeId: options.themeId } : {}),
    addons: options.addons,
    target: options.target as "android-compose" | "expo" | "flutter" | "tauri-solid",
  };
}

export async function writeGeneratedProject(
  options: NewOptions,
): Promise<{ directory: string; zipPath: string; command: string; files: number; bytes: number; warnings: string[] }> {
  const request = requestFromNewOptions(options);
  const materialized = await materializeProject(request);
  if (materialized.plan.strategy === "delegate") {
    const root = resolve(options.outDir);
    if (existsSync(root)) {
      if (!options.force) {
        throw new LaunchbedError("IO_ERROR", `Refusing to overwrite ${options.outDir} because it already exists. Pass --force to replace it.`);
      }
      rmSync(root, { recursive: true, force: true });
    }
    const step = materialized.plan.steps[0];
    if (!step) {
      throw new LaunchbedError("DELEGATE_ERROR", "Delegate plan is missing the official CLI step.");
    }
    runDelegateStep(step, { cwd: dirname(root), outputPath: root });
    writeProjectTree(materialized.files, root, { force: true });
    // Pinned dependency installs (for example AsyncStorage or shared_preferences) run inside the project.
    for (const extra of materialized.plan.steps.slice(1)) {
      runDelegateStep(extra, { cwd: root });
    }
  }
  const directory = materialized.plan.strategy === "delegate"
    ? resolve(options.outDir)
    : writeProjectTree(materialized.files, options.outDir, { force: options.force });
  const zipPath = `${directory}.zip`;
  if (existsSync(zipPath) && !options.force) {
    throw new LaunchbedError("IO_ERROR", `Refusing to overwrite ${zipPath}. Pass --force to replace it.`);
  }
  const zip = createZip(
    [...materialized.files.entries()].map(([path, data]) => ({
      path,
      data,
      executable: isExecutablePath(path),
    })),
  );
  verifyZipAgainstPlan(zip, materialized.plan);
  mkdirSync(dirname(zipPath), { recursive: true });
  const temporary = `${zipPath}.tmp-${process.pid}`;
  writeFileSync(temporary, zip);
  renameSync(temporary, zipPath);
  const command = formatNewCommand({
    projectName: options.projectName,
    applicationId: options.applicationId,
    preset: options.preset,
    addons: options.addons,
    out: options.outDir,
    target: options.target,
    themeId: options.themeId,
  });
  return {
    directory,
    zipPath,
    command,
    files: materialized.plan.totals.files,
    bytes: materialized.plan.totals.bytes,
    warnings: materialized.warnings,
  };
}
