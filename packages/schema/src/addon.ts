import { z } from "zod";
import { FileOperationSchema } from "./operations";
import { SDK_LIMITS } from "./limits";
import { ToolingContributionSchema, toolingIsEmpty } from "./tooling";
import { DEFAULT_TARGET, TARGET_IDS } from "./targets";

export const ADDON_CATEGORIES = ["storage", "ui", "native", "tooling", "foundation"] as const;
export const ADDON_STATUSES = ["stable", "beta", "experimental", "planned"] as const;

export type AddonCategory = (typeof ADDON_CATEGORIES)[number];
export type AddonStatus = (typeof ADDON_STATUSES)[number];

const ADDON_ID = /^[a-z][a-z0-9-]*\/[a-z][a-z0-9-]*$/;
const CAPABILITY = /^[a-z][a-z0-9-]*$/;
const LOCAL_TEMPLATE_REF = /^[a-z0-9-]+(\/[a-z0-9-]+)*$/;
const HTTPS_URL = /^https:\/\/[a-z0-9.-]+\/[\w./%#?=&+:@!$'()*,-]*$/i;
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
export const SLOT_IDS = ["settings-includes", "root-plugins", "app-plugins", "app-dependencies", "app-room-config", "app-imports", "app-routes", "app-entries", "main-content"] as const;
export type SlotId = (typeof SLOT_IDS)[number];
export const SLOT_FILE: Partial<Record<SlotId, string>> = {
  "settings-includes": "settings.gradle.kts",
  "root-plugins": "build.gradle.kts",
  "app-plugins": "app/build.gradle.kts",
  "app-dependencies": "app/build.gradle.kts",
  "app-room-config": "app/build.gradle.kts",
};


export const AddonRequirementsSchema = z
  .strictObject({
    minSdk: z.number().int().min(SDK_LIMITS.minSdk.min).max(SDK_LIMITS.minSdk.max).optional(),
    compileSdk: z.number().int().min(SDK_LIMITS.compileSdk.min).max(SDK_LIMITS.compileSdk.max).optional(),
    jdk: z.number().int().min(17).max(25).optional(),
  })
  .default({});

export const AddonCompatibilitySchema = z
  .strictObject({
    /** Android versions the addon is intended to run on, e.g. "8.0+". */
    android: z.array(z.string().min(1).max(40)).max(12).default([]),
    notes: z.array(z.string().min(1).max(300)).max(12).default([]),
  })
  .default({ android: [], notes: [] });

export const AddonManifestSchema = z
  .strictObject({
    id: z.string().regex(ADDON_ID, "must be a category/name id such as storage/room"),
    version: z.string().regex(SEMVER, "must be a semantic version such as 0.1.0"),
    displayName: z.string().min(1).max(80),
    description: z.string().min(1).max(280),
    category: z.enum(ADDON_CATEGORIES),
    status: z.enum(ADDON_STATUSES),
    dependencies: z.array(z.string().regex(ADDON_ID)).max(16).default([]),
    conflicts: z.array(z.string().regex(ADDON_ID)).max(16).default([]),
    capabilities: z.array(z.string().regex(CAPABILITY)).max(16).default([]),
    /** Targets this addon may be applied to. Defaults to android-compose only. */
    targets: z.array(z.enum(TARGET_IDS)).min(1).max(8).default([DEFAULT_TARGET]),
    requirements: AddonRequirementsSchema,
    fileOperations: z.array(FileOperationSchema).max(40).default([]),
    tooling: ToolingContributionSchema,
    compatibility: AddonCompatibilitySchema,
    license: z.string().regex(/^[A-Za-z0-9.+-]+$/, "must be an SPDX license identifier").default("MIT"),
    docsUrl: z.string().regex(HTTPS_URL, "must be an https URL").optional(),
  })
  .superRefine((addon, ctx) => {
    if (addon.dependencies.includes(addon.id)) {
      ctx.addIssue({ code: "custom", path: ["dependencies"], message: "an addon cannot depend on itself" });
    }
    if (addon.conflicts.includes(addon.id)) {
      ctx.addIssue({ code: "custom", path: ["conflicts"], message: "an addon cannot conflict with itself" });
    }
    const overlap = addon.dependencies.filter((id) => addon.conflicts.includes(id));
    if (overlap.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["conflicts"],
        message: `ids cannot be both dependencies and conflicts: ${overlap.join(", ")}`,
      });
    }
    if (new Set(addon.dependencies).size !== addon.dependencies.length) {
      ctx.addIssue({ code: "custom", path: ["dependencies"], message: "dependencies must be unique" });
    }
    if (new Set(addon.conflicts).size !== addon.conflicts.length) {
      ctx.addIssue({ code: "custom", path: ["conflicts"], message: "conflicts must be unique" });
    }
    if (new Set(addon.capabilities).size !== addon.capabilities.length) {
      ctx.addIssue({ code: "custom", path: ["capabilities"], message: "capabilities must be unique" });
    }
    const declaredCategory = addon.id.split("/")[0];
    if (declaredCategory !== addon.category) {
      ctx.addIssue({
        code: "custom",
        path: ["id"],
        message: `id prefix must match category "${addon.category}"`,
      });
    }
    if (addon.status === "planned" && addon.fileOperations.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["fileOperations"],
        message: "planned addons are declarative only and cannot declare file operations",
      });
    }
    if ((addon.status === "planned" || addon.status === "experimental") && !toolingIsEmpty(addon.tooling)) {
      ctx.addIssue({
        code: "custom",
        path: ["tooling"],
        message: "planned and experimental addons cannot declare mise or just contributions",
      });
    }
    if ((addon.status === "stable" || addon.status === "beta") && addon.fileOperations.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["fileOperations"],
        message: "stable and beta addons must declare at least one file operation",
      });
    }
  });

export type AddonManifest = z.infer<typeof AddonManifestSchema>;
export type AddonManifestInput = z.input<typeof AddonManifestSchema>;


/** Whether the generator may emit code for this addon. Planned and experimental addons are never emitted. */
export function isGeneratable(addon: AddonManifest): boolean {
  return (addon.status === "stable" || addon.status === "beta") && addon.fileOperations.length > 0;
}
