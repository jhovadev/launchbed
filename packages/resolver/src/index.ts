import {
  LaunchbedError,
  LIMITS,
  isGeneratable,
  type AddonManifest,
  type ProjectRequest,
  type TargetId,
} from "@launchbed/schema";
import { assertAddonsForTarget, assertTargetGeneratable } from "./rules";

export interface ResolvedRequirements {
  minSdk: number;
  compileSdk: number;
  jdk: number;
}

export interface ResolutionResult {
  /** Selected addons plus transitive dependencies, in deterministic install order. */
  addons: AddonManifest[];
  requirements: ResolvedRequirements;
  warnings: string[];
}

export interface ResolveOptions {
  /** Base JDK used by the template; addon requirements may raise it. */
  baseJdk?: number;
}

function indexCatalog(catalog: readonly AddonManifest[]): Map<string, AddonManifest> {
  const index = new Map<string, AddonManifest>();
  for (const addon of catalog) {
    if (index.has(addon.id)) {
      throw new LaunchbedError("RESOLUTION_ERROR", `Duplicate addon manifest id: ${addon.id}`);
    }
    index.set(addon.id, addon);
  }
  return index;
}

function generateError(message: string, issues: { path: string; message: string }[] = []): never {
  throw new LaunchbedError("RESOLUTION_ERROR", message, issues);
}

export function resolveAddons(
  request: ProjectRequest,
  catalog: readonly AddonManifest[],
  options: ResolveOptions = {},
): ResolutionResult {
  const index = indexCatalog(catalog);
  const selected = [...new Set(request.addons)].sort();
  const warnings: string[] = [];
  const target = request.target as TargetId;
  assertTargetGeneratable(target);

  if (selected.length > LIMITS.addons) {
    generateError(`At most ${LIMITS.addons} addons can be selected.`);
  }

  // 1. Explicit selections must exist and be generatable.
  for (const id of selected) {
    const addon = index.get(id);
    if (!addon) {
      throw new LaunchbedError(
        "UNKNOWN_ADDON",
        `Unknown addon "${id}".`,
        [{ path: "addons", message: `unknown addon ${id}` }],
      );
    }
    if (!isGeneratable(addon)) {
      generateError(
        `Addon "${id}" is ${addon.status} and cannot be generated yet. Planned and experimental addons are declarative only.`,
        [{ path: "addons", message: `${id} is ${addon.status}` }],
      );
    }
  }

  // 2. Pull transitive dependencies with cycle and depth detection.
  const included = new Set<string>();
  const stack: string[] = [];

  const visit = (id: string, depth: number, parent?: string): void => {
    if (depth > LIMITS.resolutionDepth) {
      generateError(`Addon dependency graph is deeper than ${LIMITS.resolutionDepth} levels at "${id}".`);
    }
    if (included.has(id)) return;
    if (stack.includes(id)) {
      generateError(`Addon dependency cycle detected: ${[...stack, id].join(" -> ")}`);
    }
    const addon = index.get(id);
    if (!addon) {
      generateError(
        parent
          ? `Addon "${parent}" depends on unknown addon "${id}".`
          : `Unknown addon "${id}".`,
      );
    }
    if (!isGeneratable(addon)) {
      generateError(
        `Addon dependency "${id}" is ${addon.status} and cannot be generated yet.`,
        [{ path: "addons", message: `${id} is ${addon.status}` }],
      );
    }
    stack.push(id);
    const dependencies = addon.targetDependencies[target] ?? addon.dependencies;
    for (const dependency of [...dependencies].sort()) {
      visit(dependency, depth + 1, id);
    }
    stack.pop();
    included.add(id);
  };

  for (const id of selected) visit(id, 0);

  const ordered = [...included].sort().map((id) => index.get(id)!);

  // 2b. Target compatibility (centralized rules; addon's targets list is the allowlist).
  assertAddonsForTarget(ordered, target);

  // 3. Conflicts: explicit and transitive selections are all checked.
  for (const addon of ordered) {
    for (const blocked of addon.conflicts) {
      if (!included.has(blocked)) continue;
      const [first, second] = [addon.id, blocked].sort();
      generateError(
        `Addons "${first}" and "${second}" cannot be used together.`,
        [{ path: "addons", message: `${first} conflicts with ${second}` }],
      );
    }
  }

  // 4. Merge requirements and verify the request satisfies them.
  const requirements: ResolvedRequirements = {
    minSdk: request.minSdk,
    compileSdk: request.compileSdk,
    jdk: options.baseJdk ?? 17,
  };
  for (const addon of ordered) {
    if (addon.requirements.minSdk !== undefined && addon.requirements.minSdk > requirements.minSdk) {
      requirements.minSdk = addon.requirements.minSdk;
    }
    if (addon.requirements.compileSdk !== undefined && addon.requirements.compileSdk > requirements.compileSdk) {
      requirements.compileSdk = addon.requirements.compileSdk;
    }
    if (addon.requirements.jdk !== undefined && addon.requirements.jdk > requirements.jdk) {
      requirements.jdk = addon.requirements.jdk;
    }
  }

  if (request.minSdk < requirements.minSdk) {
    const blocking = ordered.filter(
      (addon) => (addon.requirements.minSdk ?? 0) > request.minSdk,
    );
    generateError(
      `minSdk ${request.minSdk} is too low for: ${blocking.map((a) => a.id).join(", ")}. Use minSdk ${requirements.minSdk} or higher.`,
      [{ path: "minSdk", message: `requires minSdk ${requirements.minSdk}` }],
    );
  }
  if (request.compileSdk < requirements.compileSdk) {
    generateError(
      `compileSdk ${request.compileSdk} is too low for the selected addons (${requirements.compileSdk} required).`,
      [{ path: "compileSdk", message: `requires compileSdk ${requirements.compileSdk}` }],
    );
  }

  for (const addon of ordered) {
    if (addon.status === "beta") {
      warnings.push(`Addon "${addon.id}" is beta. Review its compatibility notes before shipping.`);
    }
  }
  if (ordered.length === 0) {
    warnings.push("No addons selected; the minimal template is generated.");
  }

  return { addons: ordered, requirements, warnings };
}

export { addonAppliesTo, incompatibleAddonMessage, assertAddonsForTarget, assertTargetGeneratable } from "./rules";
