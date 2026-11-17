import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { REGISTRY_FILES } from "./registry.generated";
import {
  LaunchbedError,
  LAUNCHBED_PROJECT_FILE,
  LaunchbedProjectConfigSchema,
  type LaunchbedProjectConfig,
  type TargetId,
} from "@launchbed/schema";

export interface ComponentTargetSupport {
  status: "supported" | "unsupported";
  reason?: string;
  source?: string;
  destination?: string;
}

export interface ComponentContract {
  name: string;
  displayName: string;
  description: string;
  variants: string[];
  sizes: string[];
  states: string[];
  tokens: string[];
  props: unknown[];
  a11y: string;
  targets: Record<string, ComponentTargetSupport>;
}

export interface ComponentCatalog {
  components: ComponentContract[];
}

const REQUIRED_TARGETS: TargetId[] = ["android-compose", "expo", "flutter"];

/**
 * Locates registry/components on disk. Only used by tests and tooling; runtime
 * code reads the embedded REGISTRY_FILES so it also works under Node SSR/Vercel
 * (Bun-only module paths are undefined there and the repository is not deployed).
 */
export function registryRoot(from: string = process.cwd()): string {
  const candidates = [resolve(from, "registry/components"), resolve(from, "../../registry/components")];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  throw new LaunchbedError("IO_ERROR", "Could not find the Launchbed component registry (registry/components).");
}

/** Embedded registry file (path relative to registry/components), or undefined. */
export function registrySource(path: string): string | undefined {
  return REGISTRY_FILES[path];
}

/**
 * Component contracts, sorted by name. Reads the embedded registry by default;
 * pass a directory to read contracts from disk instead.
 */
export function loadComponentCatalog(root?: string): ComponentCatalog {
  if (root !== undefined) {
    const names = readdirSync(root).filter((name) => existsSync(join(root, name, "contract.json"))).sort();
    return { components: names.map((name) => JSON.parse(readFileSync(join(root, name, "contract.json"), "utf8")) as ComponentContract) };
  }
  const names = Object.keys(REGISTRY_FILES)
    .filter((path) => /^[a-z0-9-]+\/contract\.json$/.test(path))
    .map((path) => path.split("/")[0]!)
    .sort();
  return { components: names.map((name) => JSON.parse(REGISTRY_FILES[`${name}/contract.json`]!) as ComponentContract) };
}

export interface ComponentSourceFile {
  target: string;
  path: string;
  destination: string;
  content: string;
}

/** Per-target source files for one component, from the embedded registry. */
export function componentSources(contract: ComponentContract): ComponentSourceFile[] {
  const files: ComponentSourceFile[] = [];
  for (const [target, support] of Object.entries(contract.targets)) {
    if (support.status !== "supported" || !support.source || !support.destination) continue;
    const content = REGISTRY_FILES[`${contract.name}/${support.source}`];
    if (content === undefined) continue;
    files.push({ target, path: support.source, destination: support.destination, content });
  }
  return files;
}

/** Every contract must declare all generatable targets, or an explicit unsupported reason. */
export function contractProblems(contract: ComponentContract): string[] {
  const problems: string[] = [];
  for (const target of REQUIRED_TARGETS) {
    const entry = contract.targets[target];
    if (!entry) {
      problems.push(`${contract.name} does not declare target ${target}.`);
      continue;
    }
    if (entry.status === "supported") {
      if (!entry.source || !entry.destination) {
        problems.push(`${contract.name} (${target}) is supported but missing source or destination.`);
      }
    } else if (entry.status === "unsupported") {
      if (!entry.reason) {
        problems.push(`${contract.name} (${target}) is unsupported without an explicit reason.`);
      }
    } else {
      problems.push(`${contract.name} (${target}) has an unknown status.`);
    }
  }
  return problems;
}

export function findLaunchbedConfig(start = process.cwd()): { root: string; config: LaunchbedProjectConfig } {
  let current = resolve(start);
  for (let i = 0; i < 8; i += 1) {
    const file = join(current, LAUNCHBED_PROJECT_FILE);
    if (existsSync(file)) {
      const parsed = LaunchbedProjectConfigSchema.safeParse(JSON.parse(readFileSync(file, "utf8")));
      if (!parsed.success) {
        throw new LaunchbedError("INVALID_REQUEST", `${LAUNCHBED_PROJECT_FILE} is invalid.`);
      }
      return { root: current, config: parsed.data };
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  throw new LaunchbedError("IO_ERROR", `No ${LAUNCHBED_PROJECT_FILE} found. Generate a project with launchbed new first.`);
}

/** Only {{packageName}} and {{packagePath}} are substituted so TSX `{{ disabled }}` is left alone. */
function renderKnownPlaceholders(source: string, vars: Record<string, string>): string {
  return source.replace(/\{\{\s*(packageName|packagePath)\s*\}\}/g, (_match, key: string) => vars[key] ?? _match);
}

export function addComponent(options: {
  name: string;
  projectRoot?: string;
  force?: boolean;
}): { path: string; wrote: boolean } {
  const { root, config } = findLaunchbedConfig(options.projectRoot);
  const catalog = loadComponentCatalog();
  const contract = catalog.components.find((item) => item.name === options.name);
  if (!contract) {
    throw new LaunchbedError("INVALID_REQUEST", `Unknown component "${options.name}". Run launchbed components --json.`);
  }
  const support = contract.targets[config.target];
  if (!support || support.status !== "supported" || !support.source || !support.destination) {
    const reason = support?.reason ?? `Component "${options.name}" does not support target ${config.target}.`;
    throw new LaunchbedError("INCOMPATIBLE_ADDON", reason);
  }
  const source = REGISTRY_FILES[`${contract.name}/${support.source}`];
  if (source === undefined) {
    throw new LaunchbedError("IO_ERROR", `Registry source missing for ${options.name} (${config.target}).`);
  }
  const packagePath = (config.packageName ?? config.applicationId).replaceAll(".", "/");
  const vars = { packagePath, packageName: config.packageName ?? config.applicationId };
  const renderedPath = renderKnownPlaceholders(support.destination, vars);
  const destination = join(root, renderedPath);
  const rendered = renderKnownPlaceholders(source, vars);
  if (existsSync(destination)) {
    const existing = readFileSync(destination, "utf8");
    if (existing === rendered) {
      return { path: renderedPath, wrote: false };
    }
    if (!options.force) {
      throw new LaunchbedError(
        "IO_ERROR",
        `${renderedPath} already exists and differs. Pass --force to overwrite.`,
      );
    }
  }
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, rendered, { encoding: "utf8" });
  if (!config.components.includes(options.name)) {
    config.components = [...config.components, options.name].sort();
    writeFileSync(join(root, LAUNCHBED_PROJECT_FILE), `${JSON.stringify(config, null, 2)}\n`);
  }
  return { path: renderedPath, wrote: true };
}
