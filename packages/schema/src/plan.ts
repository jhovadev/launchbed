import { z } from "zod";
import { GENERATION_SCHEMA_VERSION, TEMPLATE_ID } from "./limits";
import { validateRelativePath } from "./identifiers";

export const PlannedFileSchema = z
  .strictObject({
    /** Relative, POSIX-style path inside the generated project. */
    path: z.string().superRefine((value, ctx) => {
      for (const problem of validateRelativePath(value)) {
        ctx.addIssue({ code: "custom", message: problem });
      }
    }),
    /** Uncompressed size in bytes. */
    size: z.number().int().nonnegative(),
    /** Lowercase hex SHA-256 of the exact bytes written to the ZIP. */
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
    /** Where the file came from. */
    origin: z.enum(["template", "generated", "addon"]),
  })
  .superRefine((file, ctx) => {
    if (file.path.endsWith("/")) {
      ctx.addIssue({ code: "custom", path: ["path"], message: "files must not end with a slash" });
    }
  });

export const GenerationPlanSchema = z.strictObject({
  schemaVersion: z.literal(GENERATION_SCHEMA_VERSION),
  template: z.strictObject({
    id: z.literal(TEMPLATE_ID),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
  }),
  request: z.strictObject({
    /** SHA-256 over the canonical normalized request. */
    hash: z.string().regex(/^[0-9a-f]{64}$/),
    projectName: z.string(),
    applicationId: z.string(),
    namespace: z.string(),
    packageName: z.string(),
    minSdk: z.number().int(),
    compileSdk: z.number().int(),
    targetSdk: z.number().int(),
    addons: z.array(z.string()),
  }),
  files: z.array(PlannedFileSchema),
  totals: z.strictObject({
    files: z.number().int().nonnegative(),
    bytes: z.number().int().nonnegative(),
  }),
  warnings: z.array(z.string()),
});

export type PlannedFile = z.infer<typeof PlannedFileSchema>;
export type GenerationPlan = z.infer<typeof GenerationPlanSchema>;

export const CatalogEntrySchema = z.strictObject({
  id: z.string(),
  version: z.string(),
  displayName: z.string(),
  description: z.string(),
  category: z.enum(["storage", "ui", "native", "tooling"]),
  status: z.enum(["stable", "beta", "experimental", "planned"]),
  generatable: z.boolean(),
  capabilities: z.array(z.string()),
  dependencies: z.array(z.string()),
  conflicts: z.array(z.string()),
  requirements: z.strictObject({
    minSdk: z.number().int().optional(),
    compileSdk: z.number().int().optional(),
    jdk: z.number().int().optional(),
  }),
  compatibility: z.strictObject({
    android: z.array(z.string()),
    notes: z.array(z.string()),
  }),
  license: z.string(),
});

export type CatalogEntry = z.infer<typeof CatalogEntrySchema>;

export const CatalogResponseSchema = z.strictObject({
  template: z.strictObject({
    id: z.literal(TEMPLATE_ID),
    version: z.string(),
    displayName: z.string(),
    minSdk: z.number().int(),
    compileSdk: z.number().int(),
    targetSdk: z.number().int(),
  }),
  addons: z.array(CatalogEntrySchema),
  limits: z.strictObject({
    requestBytes: z.number().int(),
    files: z.number().int(),
    totalBytes: z.number().int(),
    addons: z.number().int(),
  }),
});

export type CatalogResponse = z.infer<typeof CatalogResponseSchema>;
