import { z } from "zod";
import { ThemeConfigSchema } from "./theme";
import { SDK_LIMITS } from "./limits";
import { TARGET_IDS } from "./targets";

export const PRESET_STATUSES = ["stable", "beta", "planned"] as const;
export const PRESET_CATEGORIES = ["application", "feature", "demo"] as const;

const PRESET_ID = /^[a-z][a-z0-9-]*$/;
const ADDON_ID = z.string().regex(/^[a-z][a-z0-9-]*\/[a-z][a-z0-9-]*$/);

export const ProjectPresetManifestSchema = z.strictObject({
  id: z.string().regex(PRESET_ID, "must be a kebab-case preset id"),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  name: z.string().min(1).max(80),
  description: z.string().min(1).max(300),
  category: z.enum(PRESET_CATEGORIES),
  status: z.enum(PRESET_STATUSES),
  baseTemplate: z.literal("android-compose-minimal"),
  requiredAddons: z.array(z.string().regex(/^[a-z][a-z0-9-]*\/[a-z][a-z0-9-]*$/)).max(24).default([]),
  optionalAddons: z.array(z.string().regex(/^[a-z][a-z0-9-]*\/[a-z][a-z0-9-]*$/)).max(24).default([]),
  defaultTheme: ThemeConfigSchema,
  previewScreens: z.array(z.enum(["welcome", "dashboard", "settings", "notes", "catalog", "onboarding", "login", "register", "profile"])).max(8).default(["welcome"]),
  compatibility: z.strictObject({
    minSdk: z.number().int().min(SDK_LIMITS.minSdk.min).max(SDK_LIMITS.minSdk.max),
    notes: z.array(z.string().min(1).max(300)).max(12).default([]),
  }),
  capabilities: z.array(z.string().regex(/^[a-z][a-z0-9-]*$/)).max(24).default([]),
  /** Targets this preset generates for. android-compose uses requiredAddons. */
  targets: z.array(z.enum(TARGET_IDS)).min(1).max(8).default(["android-compose"]),
  /** Per-target equivalent add-on sets for delegate targets (Expo, Flutter, ...). */
  targetAddons: z
    .strictObject({
      expo: z.array(ADDON_ID).max(24).optional(),
      flutter: z.array(ADDON_ID).max(24).optional(),
      "tauri-solid": z.array(ADDON_ID).max(24).optional(),
    })
    .default({}),
});

/** Add-ons a preset contributes for one target, or undefined when the preset does not support it. */
export function presetAddonsForTarget(
  preset: Pick<ProjectPresetManifest, "targets" | "requiredAddons" | "targetAddons">,
  target: (typeof TARGET_IDS)[number],
): readonly string[] | undefined {
  if (!preset.targets.includes(target)) return undefined;
  if (target === "android-compose") return preset.requiredAddons;
  return preset.targetAddons[target] ?? preset.requiredAddons;
}

export type ProjectPresetManifest = z.infer<typeof ProjectPresetManifestSchema>;
export type ProjectPresetManifestInput = z.input<typeof ProjectPresetManifestSchema>;
