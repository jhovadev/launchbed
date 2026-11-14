import { z } from "zod";
import { validateRelativePath } from "./identifiers";
import { SDK_LIMITS } from "./limits";

export const ADDON_CATEGORIES = ["storage", "ui", "native", "tooling"] as const;
export const ADDON_STATUSES = ["stable", "beta", "experimental", "planned"] as const;

export type AddonCategory = (typeof ADDON_CATEGORIES)[number];
export type AddonStatus = (typeof ADDON_STATUSES)[number];

const ADDON_ID = /^[a-z][a-z0-9-]*\/[a-z][a-z0-9-]*$/;
const CAPABILITY = /^[a-z][a-z0-9-]*$/;
const LOCAL_TEMPLATE_REF = /^[a-z0-9-]+(\/[a-z0-9-]+)*$/;
const HTTPS_URL = /^https:\/\/[a-z0-9.-]+\/[\w./%#?=&+:@!$'()*,-]*$/i;
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export const FileOperationSchema = z
  .strictObject({
    type: z.enum(["add", "append", "modify"]),
    /** Path inside the generated project. Must be relative and safe. */
    path: z.string().superRefine((value, ctx) => {
      for (const problem of validateRelativePath(value)) {
        ctx.addIssue({ code: "custom", message: problem });
      }
    }),
    /** Identifier of a local fragment under templates/fragments. Never a URL. */
    template: z
      .string()
      .regex(LOCAL_TEMPLATE_REF, "must reference a local fragment, not a remote template"),
    description: z.string().min(1).max(200).optional(),
  })
  .superRefine((operation, ctx) => {
    if (operation.type === "add" && operation.path.endsWith("/")) {
      ctx.addIssue({
        code: "custom",
        path: ["path"],
        message: "an add operation must target a file, not a directory",
      });
    }
  });

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
    requirements: AddonRequirementsSchema,
    fileOperations: z.array(FileOperationSchema).max(40).default([]),
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
export type FileOperation = z.infer<typeof FileOperationSchema>;

/** Whether the generator may emit code for this addon. Planned and experimental addons are never emitted. */
export function isGeneratable(addon: AddonManifest): boolean {
  return (addon.status === "stable" || addon.status === "beta") && addon.fileOperations.length > 0;
}
