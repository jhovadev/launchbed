import { z } from "zod";
import { validatePackageId, validateProjectName } from "./identifiers";
import { DEFAULT_SDK, LIMITS, SDK_LIMITS, TEMPLATE_ID } from "./limits";
import { ThemeConfigSchema } from "./theme";
import { DEFAULT_TARGET, TARGET_IDS } from "./targets";

const sdkLevel = (bounds: { min: number; max: number }, label: string) =>
  z
    .number()
    .int(`${label} must be an integer API level`)
    .min(bounds.min, `${label} must be >= ${bounds.min}`)
    .max(bounds.max, `${label} must be <= ${bounds.max}`);

const packageId = z
  .string()
  .superRefine((value, ctx) => {
    for (const problem of validatePackageId(value)) {
      ctx.addIssue({ code: "custom", message: problem });
    }
  });

export const ProjectRequestSchema = z
  .strictObject({
    template: z.literal(TEMPLATE_ID).default(TEMPLATE_ID),
    /** Generation target. Defaults to android-compose for backward compatibility. */
    target: z.enum(TARGET_IDS).default(DEFAULT_TARGET),
    projectName: z.string().superRefine((value, ctx) => {
      for (const problem of validateProjectName(value)) {
        ctx.addIssue({ code: "custom", message: problem });
      }
    }),
    /** Unique ID installed on the device. Must not be changed after publishing. */
    applicationId: packageId,
    /** Android namespace used for R and BuildConfig. May differ from applicationId. */
    namespace: packageId,
    /** Kotlin source package. Defaults to namespace. */
    packageName: packageId.optional(),
    minSdk: sdkLevel(SDK_LIMITS.minSdk, "minSdk").default(DEFAULT_SDK.min),
    compileSdk: sdkLevel(SDK_LIMITS.compileSdk, "compileSdk").default(DEFAULT_SDK.compile),
    targetSdk: sdkLevel(SDK_LIMITS.targetSdk, "targetSdk").default(DEFAULT_SDK.target),
    theme: ThemeConfigSchema,
    preset: z.string().regex(/^[a-z][a-z0-9-]*$/).optional(),
    addons: z
      .array(z.string().regex(/^[a-z][a-z0-9-]*\/[a-z][a-z0-9-]*$/, "must be an addon id such as storage/room"))
      .max(LIMITS.addons, `at most ${LIMITS.addons} addons may be selected`)
      .default([]),
  })
  .superRefine((request, ctx) => {
    if (request.targetSdk < request.minSdk) {
      ctx.addIssue({
        code: "custom",
        path: ["targetSdk"],
        message: `targetSdk (${request.targetSdk}) must be >= minSdk (${request.minSdk})`,
      });
    }
    if (request.targetSdk > request.compileSdk) {
      ctx.addIssue({
        code: "custom",
        path: ["targetSdk"],
        message: `targetSdk (${request.targetSdk}) must be <= compileSdk (${request.compileSdk})`,
      });
    }
    if (request.minSdk > request.compileSdk) {
      ctx.addIssue({
        code: "custom",
        path: ["minSdk"],
        message: `minSdk (${request.minSdk}) must be <= compileSdk (${request.compileSdk})`,
      });
    }
    const unique = new Set(request.addons);
    if (unique.size !== request.addons.length) {
      ctx.addIssue({
        code: "custom",
        path: ["addons"],
        message: "addon ids must be unique",
      });
    }
  });

export type ProjectRequest = z.infer<typeof ProjectRequestSchema>;
export type ProjectRequestInput = z.input<typeof ProjectRequestSchema>;

/** Normalizes a validated request (packageName defaults to namespace). */
export function normalizeRequest(request: ProjectRequest): ProjectRequest {
  return {
    ...request,
    packageName: request.packageName ?? request.namespace,
    addons: [...new Set(request.addons)].sort(),
  };
}
