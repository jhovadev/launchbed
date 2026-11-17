import {
  LaunchbedError,
  findTarget,
  isGeneratableTarget,
  type AddonManifest,
  type TargetId,
} from "@launchbed/schema";

export interface CompatibilityContext {
  target: TargetId;
  addon: AddonManifest;
}

/**
 * Centralized Bati-style compatibility rules. The addon's `targets` list is the
 * allowlist; these rules only supply a precise, user-facing reason when it is
 * rejected.
 */
export function incompatibleAddonMessage(addon: AddonManifest, target: TargetId): string {
  if (addon.category === "ui") {
    return `Addon "${addon.id}" is a Jetpack Compose UI pack and only applies to the android-compose target, not ${target}.`;
  }
  if (addon.category === "storage") {
    return `Addon "${addon.id}" is an Android storage pack and does not apply to ${target}.`;
  }
  if (addon.category === "native") {
    return `Addon "${addon.id}" is a native Android FFI pack and does not apply to ${target}.`;
  }
  const compatible = addon.targets.join(", ");
  return `Addon "${addon.id}" does not apply to target "${target}". Compatible targets: ${compatible}.`;
}

export function addonAppliesTo(addon: AddonManifest, target: TargetId): boolean {
  return addon.targets.includes(target);
}

export function assertTargetGeneratable(targetId: string): asserts targetId is TargetId {
  const target = findTarget(targetId);
  if (!target) {
    throw new LaunchbedError(
      "UNKNOWN_TARGET",
      `Unknown target "${targetId}". Known targets: android-compose, expo, flutter, tauri-solid.`,
      [{ path: "target", message: `unknown target ${targetId}` }],
    );
  }
  if (!isGeneratableTarget(target)) {
    throw new LaunchbedError(
      "UNKNOWN_TARGET",
      `Target "${target.id}" is ${target.status} and cannot be generated yet.`,
      [{ path: "target", message: `${target.id} is ${target.status}` }],
    );
  }
}

export function assertAddonsForTarget(addons: readonly AddonManifest[], target: TargetId): void {
  const blocked = addons.filter((addon) => !addonAppliesTo(addon, target));
  if (blocked.length === 0) return;
  const [first] = blocked;
  throw new LaunchbedError(
    "INCOMPATIBLE_ADDON",
    incompatibleAddonMessage(first!, target),
    blocked.map((addon) => ({
      path: "addons",
      message: `${addon.id} does not apply to ${target}`,
    })),
  );
}
