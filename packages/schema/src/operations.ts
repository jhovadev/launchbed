import { z } from "zod";
import { validateRelativePath } from "./identifiers";

const LOCAL_TEMPLATE_REF = /^[a-z0-9-]+(\/[a-z0-9-]+)*$/;
const SLOT_ID = /^(settings-includes|root-plugins|app-plugins|app-dependencies|app-room-config|app-imports|app-routes|app-entries|main-content|manifest-permissions)$/;
const ALIAS = /^[a-z][a-z0-9]*([.-][a-z0-9]+)*$/;
const MODULE = /^[a-z][a-z0-9_.-]*:[a-z][a-z0-9_.-]*$/;
const VERSION_ID = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;
const GRADLE_MODULE = /^:[a-z][a-z0-9-]*(:[a-z][a-z0-9-]*)*$/;

const safePath = z.string().superRefine((value, ctx) => {
  for (const problem of validateRelativePath(value)) {
    ctx.addIssue({ code: "custom", message: problem });
  }
});

const fragment = z
  .string()
  .regex(LOCAL_TEMPLATE_REF, "must reference a local fragment, not a remote template");

const description = z.string().min(1).max(200).optional();

const addOperation = z.strictObject({
  type: z.literal("add"),
  path: safePath,
  template: fragment,
  description,
});

const insertOperation = z.strictObject({
  type: z.literal("insert"),
  path: safePath,
  slot: z.string().regex(SLOT_ID, "must be a documented template slot"),
  template: fragment,
  description,
});

const legacyAppend = z.strictObject({
  type: z.literal("append"),
  path: safePath,
  template: fragment,
  description,
});

const legacyModify = z.strictObject({
  type: z.literal("modify"),
  path: safePath,
  template: fragment,
  description,
});

const catalogMerge = z
  .strictObject({
    type: z.literal("merge"),
    target: z.literal("version-catalog"),
    alias: z.string().regex(ALIAS, "must be a catalog alias such as compose-bom"),
    module: z.string().regex(MODULE, "must be group:artifact coordinates").optional(),
    pluginId: z.string().regex(/^[a-z][a-z0-9.]*$/).optional(),
    versionRef: z.string().regex(VERSION_ID).optional(),
    version: z.string().regex(/^[0-9][0-9A-Za-z.+_-]*$/).optional(),
    description,
  })
  .superRefine((value, ctx) => {
    if (value.module !== undefined && value.pluginId !== undefined) {
      ctx.addIssue({ code: "custom", message: "module and pluginId are mutually exclusive" });
    }
    if (value.module === undefined && value.pluginId === undefined && value.version === undefined && value.versionRef === undefined) {
      ctx.addIssue({
        code: "custom",
        message: "a version-only entry requires version",
      });
    }
    if (value.module === undefined && value.pluginId === undefined && value.versionRef !== undefined && value.version === undefined) {
      // version reference without a coordinate is meaningless
    }
  });

const dependencyMerge = z.strictObject({
  type: z.literal("merge"),
  target: z.enum(["app-dependencies", "app-plugins", "root-plugins"]),
  alias: z.string().regex(ALIAS, "must be a catalog alias such as androidx-core"),
  description,
});

const settingsMerge = z.strictObject({
  type: z.literal("merge"),
  target: z.literal("settings-includes"),
  module: z.string().regex(GRADLE_MODULE, "must be a Gradle module such as :feature:home"),
  description,
});

export const FileOperationSchema = z
  .union([
    addOperation,
    insertOperation,
    legacyAppend,
    legacyModify,
    catalogMerge,
    dependencyMerge,
    settingsMerge,
  ])
  .superRefine((operation, ctx) => {
    if (operation.type === "add" && operation.path.endsWith("/")) {
      ctx.addIssue({
        code: "custom",
        path: ["path"],
        message: "an add operation must target a file, not a directory",
      });
    }
  });

export type FileOperation = z.infer<typeof FileOperationSchema>;
export type InsertOperation = Extract<FileOperation, { type: "insert" }>;
export type MergeOperation = Extract<FileOperation, { type: "merge" }>;
