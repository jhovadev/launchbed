#!/usr/bin/env bun
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  InitializrError,
  projectSlug,
  toErrorPayload,
} from "@android-initializr/schema";
import {
  createPlan,
  generateProject,
  getCatalog,
  parseRequestJson,
} from "@android-initializr/generator";
import { parseArgs } from "./args";
import { resolveNewOptions, writeGeneratedProject } from "./new-command";

export const USAGE = `launchbed - generate mobile starters from the command line

Usage:
  launchbed new [dir] [--name <name>] [--app-id <id>] [--preset <id>] [--addon <id>]... [--out <dir>] [--yes] [--force]
  launchbed catalog [--json]
  launchbed validate --config <file|-> [--json]
  launchbed plan --config <file|-> [--json]
  launchbed generate --config <file|-> [--out <file.zip>] [--force]
  launchbed --help

\`launchbed new\` writes a project directory and a sibling ZIP, using the same
deterministic engine as the web API. Pass --yes to skip prompts (required when
stdin is not a TTY). The android-initializr command is kept as a compatible alias.

Config files used by validate/plan/generate are JSON ProjectRequest documents.
Use "-" to read from stdin.
`;

function readConfig(path: string): string {
  if (path === "-") {
    return readFileSync(0, "utf8");
  }
  const resolved = resolve(path);
  if (!existsSync(resolved)) {
    throw new InitializrError("IO_ERROR", `Config file not found: ${path}`);
  }
  return readFileSync(resolved, "utf8");
}

function fail(error: unknown): never {
  const payload = toErrorPayload(error);
  console.error(JSON.stringify(payload, null, 2));
  process.exit(1);
}

async function main(): Promise<void> {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error((error as Error).message);
    console.error(USAGE);
    process.exit(2);
  }

  if (args.command === "help" || args.flags.has("help") || args.command === "--help") {
    console.log(USAGE);
    return;
  }

  if (args.command === "catalog") {
    const catalog = getCatalog();
    if (args.flags.has("json")) {
      console.log(JSON.stringify(catalog, null, 2));
    } else {
      console.log(`Template: ${catalog.template.displayName} (${catalog.template.version})`);
      console.log(`SDK defaults: min ${catalog.template.minSdk}, compile ${catalog.template.compileSdk}, target ${catalog.template.targetSdk}`);
      console.log("");
      for (const addon of catalog.addons) {
        const suffix = addon.generatable ? "" : ` [${addon.status}]`;
        console.log(`- ${addon.id}${suffix}: ${addon.displayName}`);
      }
    }
    return;
  }

  if (args.command === "new") {
    try {
      const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);
      const options = await resolveNewOptions(args, interactive);
      const result = writeGeneratedProject(options);
      console.log(`Created project ${result.directory}`);
      console.log(`Wrote ZIP ${result.zipPath}`);
      console.log(`Files: ${result.files}, bytes: ${result.bytes}`);
      console.log(`Equivalent command: ${result.command}`);
      for (const warning of result.warnings) console.log(`Warning: ${warning}`);
      console.log("Next: cd into the directory, run `mise install`, then `just doctor` and `just build`.");
    } catch (error) {
      if (error instanceof InitializrError) fail(error);
      console.error((error as Error).message);
      console.error(USAGE);
      process.exit(2);
    }
    return;
  }

  const configPath = args.values.get("config");
  if (!configPath) {
    console.error("--config is required. Use '-' to read from stdin.");
    process.exit(2);
  }

  try {
    const request = parseRequestJson(readConfig(configPath));

    if (args.command === "validate") {
      if (args.flags.has("json")) {
        console.log(JSON.stringify({ valid: true, request }, null, 2));
      } else {
        console.log("Request is valid.");
      }
      return;
    }

    if (args.command === "plan") {
      const plan = createPlan(request);
      if (args.flags.has("json")) {
        console.log(JSON.stringify(plan, null, 2));
      } else {
        console.log(`Template: ${plan.template.id} ${plan.template.version}`);
        console.log(`Files: ${plan.totals.files} (${plan.totals.bytes} bytes)`);
        console.log(`Addons: ${plan.request.addons.length === 0 ? "none" : plan.request.addons.join(", ")}`);
        for (const warning of plan.warnings) console.log(`Warning: ${warning}`);
        for (const file of plan.files) console.log(`  ${file.path} (${file.size} bytes)`);
      }
      return;
    }

    if (args.command === "generate") {
      const project = generateProject(request);
      const out = resolve(args.values.get("out") ?? `${projectSlug(project.plan.request.projectName)}.zip`);
      if (existsSync(out) && !args.flags.has("force")) {
        throw new InitializrError("IO_ERROR", `Refusing to overwrite ${out}. Pass --force to replace it.`);
      }
      mkdirSync(dirname(out), { recursive: true });
      const temporary = `${out}.tmp-${process.pid}`;
      writeFileSync(temporary, project.zip);
      renameSync(temporary, out);
      console.log(`Generated ${out}`);
      console.log(`Files: ${project.plan.totals.files}, bytes: ${project.plan.totals.bytes}, zip: ${project.zip.length}`);
      for (const warning of project.plan.warnings) console.log(`Warning: ${warning}`);
      return;
    }

    console.error(`Unknown command: ${args.command}`);
    console.error(USAGE);
    process.exit(2);
  } catch (error) {
    fail(error);
  }
}

void main();
