import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
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

export function registryRoot(from = import.meta.dir): string {
  const candidates = [
    resolve(from, "../../../registry/components"),
    resolve(from, "../../../../registry/components"),
    resolve(process.cwd(), "registry/components"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  throw new LaunchbedError("IO_ERROR", "Could not find the Launchbed component registry (registry/components).");
}

export function loadComponentCatalog(root = registryRoot()): ComponentCatalog {
  const names = readdirSync(root).filter((name) => existsSync(join(root, name, "contract.json"))).sort();
  const components = names.map((name) => {
    const raw = JSON.parse(readFileSync(join(root, name, "contract.json"), "utf8")) as ComponentContract;
    return raw;
  });
  return { components };
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
  const sourcePath = join(registryRoot(), contract.name, support.source);
  if (!existsSync(sourcePath)) {
    throw new LaunchbedError("IO_ERROR", `Registry source missing for ${options.name} (${config.target}).`);
  }
  const packagePath = (config.packageName ?? config.applicationId).replaceAll(".", "/");
  const vars = { packagePath, packageName: config.packageName ?? config.applicationId };
  const renderedPath = renderKnownPlaceholders(support.destination, vars);
  const destination = join(root, renderedPath);
  const source = readFileSync(sourcePath, "utf8");
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
