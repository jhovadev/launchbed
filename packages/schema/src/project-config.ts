import { z } from "zod";
import { TARGET_IDS } from "./targets";

/** Written next to a generated project so later commands (`add`, doctor) know the target. */
export const LaunchbedProjectConfigSchema = z.strictObject({
  schemaVersion: z.literal(1),
  target: z.enum(TARGET_IDS),
  projectName: z.string().min(1).max(64),
  applicationId: z.string().min(1).max(120),
  packageName: z.string().min(1).max(120).optional(),
  addons: z.array(z.string()).default([]),
  components: z.array(z.string().regex(/^[a-z][a-z0-9-]*$/)).default([]),
});

export type LaunchbedProjectConfig = z.infer<typeof LaunchbedProjectConfigSchema>;

export const LAUNCHBED_PROJECT_FILE = "launchbed.json";
