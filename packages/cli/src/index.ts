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

const USAGE = `android-initializr - generate native Android projects from the command line

Usage:
  android-initializr catalog [--json]
  android-initializr validate --config <file|-> [--json]
  android-initializr plan --config <file|-> [--json]
  android-initializr generate --config <file|-> [--out <file.zip>] [--force]
  android-initializr --help

Config is a JSON ProjectRequest. Use "-" to read from stdin.
The CLI uses the exact same engine as the web API.
`;

interface Args {
  command: string;
  values: Map<string, string>;
  flags: Set<string>;
}

function parseArgs(argv: string[]): Args {
  const [command = "help", ...rest] = argv;
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i]!;
    if (!arg.startsWith("--")) throw new Error(`Unexpected argument: ${arg}`);
    const [key, inline] = arg.slice(2).split("=", 2) as [string, string | undefined];
    if (["config", "out"].includes(key)) {
      const value = inline ?? rest[++i];
      if (!value) throw new Error(`--${key} requires a value`);
      values.set(key, value);
    } else if (["json", "force", "help"].includes(key)) {
      flags.add(key);
    } else {
      throw new Error(`Unknown option: --${key}`);
    }
  }
  return { command, values, flags };
}

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

function main(): void {
  let args: Args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error((error as Error).message);
    console.error(USAGE);
    process.exit(2);
  }

  if (args.command === "help" || args.flags.has("help")) {
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

main();
