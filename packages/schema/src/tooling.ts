import { z } from "zod";

const TOOL_NAME = /^[a-z][a-z0-9-]{0,39}$/;
const TOOL_VERSION = /^[A-Za-z0-9][A-Za-z0-9.+_-]{0,79}$/;
const RECIPE_NAME = /^[a-z][a-z0-9-]{0,39}$/;
const ENV_KEY = /^[A-Z][A-Z0-9_]{0,63}$/;
const SECRET_KEY = /SECRET|TOKEN|PASSWORD|KEYSTORE|API[_-]?KEY|PRIVATE|CREDENTIAL|AUTH_TOKEN/i;

export const JustRecipeSchema = z.strictObject({
  name: z.string().regex(RECIPE_NAME, "must be a kebab-case just recipe name"),
  description: z.string().min(1).max(160),
  lines: z.array(z.string().min(1).max(200)).min(1).max(20),
  dependencies: z.array(z.string().regex(RECIPE_NAME)).max(8).default([]),
});

export const MiseToolSchema = z.strictObject({
  name: z.string().regex(TOOL_NAME, "must be a mise tool name such as java or rust"),
  version: z.string().regex(TOOL_VERSION, "must be a pinned mise tool version"),
});

export const MiseEnvSchema = z
  .strictObject({
    key: z.string().regex(ENV_KEY, "must be an UPPER_SNAKE env key"),
    value: z.string().min(1).max(200),
  })
  .superRefine((entry, ctx) => {
    if (SECRET_KEY.test(entry.key)) {
      ctx.addIssue({
        code: "custom",
        path: ["key"],
        message: "environment keys must not look like secrets",
      });
    }
  });

export const ToolingContributionSchema = z
  .strictObject({
    tools: z.array(MiseToolSchema).max(16).default([]),
    env: z.array(MiseEnvSchema).max(16).default([]),
    justRecipes: z.array(JustRecipeSchema).max(16).default([]),
  })
  .superRefine((tooling, ctx) => {
    const toolNames = tooling.tools.map((tool) => tool.name);
    if (new Set(toolNames).size !== toolNames.length) {
      ctx.addIssue({ code: "custom", path: ["tools"], message: "tool names must be unique" });
    }
    const envKeys = tooling.env.map((entry) => entry.key);
    if (new Set(envKeys).size !== envKeys.length) {
      ctx.addIssue({ code: "custom", path: ["env"], message: "environment keys must be unique" });
    }
    const recipeNames = tooling.justRecipes.map((recipe) => recipe.name);
    if (new Set(recipeNames).size !== recipeNames.length) {
      ctx.addIssue({ code: "custom", path: ["justRecipes"], message: "recipe names must be unique" });
    }
  })
  .default({ tools: [], env: [], justRecipes: [] });

export type JustRecipe = z.infer<typeof JustRecipeSchema>;
export type MiseTool = z.infer<typeof MiseToolSchema>;
export type ToolingContribution = z.infer<typeof ToolingContributionSchema>;

export function toolingIsEmpty(tooling: ToolingContribution): boolean {
  return tooling.tools.length === 0 && tooling.env.length === 0 && tooling.justRecipes.length === 0;
}
