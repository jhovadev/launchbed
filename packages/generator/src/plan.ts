import { createHash } from "node:crypto";
import {
  ALL_ADDONS,
  buildCatalog,
  findPreset,
  isPresetGeneratable,
} from "@launchbed/catalog";
import { resolveAddons } from "@launchbed/resolver";
import {
  LaunchbedError,
  GENERATION_SCHEMA_VERSION,
  LIMITS,
  ProjectRequestSchema,
  ThemeConfigSchema,
  TEMPLATE_ID,
  TEMPLATE_VERSION,
  issuesFromZod,
  normalizeRequest,
  presetAddonsForTarget,
  homeRouteFor,
  topLevelDestinations,
  TOP_LEVEL_DESTINATIONS,
  type TopLevelDestination,
  projectSlug,
  delegateSetupCommands,
  formatNewCommand,
  overlayZipFileName,
  type DelegateStep,
  validateRelativePath,
  type AddonManifest,
  type CatalogResponse,
  type GenerationPlan,
  type ProjectRequest,
  type ProjectRequestInput,
} from "@launchbed/schema";
import {
  resolveThemeTokens,
  applyThemePreset,
  findThemePreset,
  THEME_PRESETS,
  themeTokensToDtcg,
  serializeDtcg,
  type ThemeTokens,
} from "@launchbed/design-tokens";
import { compileDesignTokens } from "@launchbed/design-tokens/style-dictionary";
import { renderText, type TemplateVars } from "./render";
import { FRAGMENT_FILES, TEMPLATE_FILES } from "./templates.generated";
import { TOOLCHAIN, sdkPlatformPackage } from "./versions";
import { createZip, readZip } from "./zip";
import { applyComposition } from "./composition";
import { applyTooling } from "./tooling";
import { buildExpoDelegate, buildFlutterDelegate, projectConfigJson } from "./overlays";
import { LAUNCHBED_PROJECT_FILE, type LaunchbedProjectConfig } from "@launchbed/schema";

const MAX_FILE_BYTES = 2 * 1024 * 1024;

export interface MaterializedProject {
  plan: GenerationPlan;
  /** Path -> exact bytes, sorted by path. */
  files: Map<string, Uint8Array>;
  warnings: string[];
}

const encoder = new TextEncoder();

export function parseRequest(input: unknown): ProjectRequest {
  const result = ProjectRequestSchema.safeParse(input);
  if (!result.success) {
    throw new LaunchbedError("INVALID_REQUEST", "The project request is invalid.", issuesFromZod(result.error));
  }
  return normalizeRequest(result.data);
}

/** Parses and validates a JSON request body, enforcing the request size limit. */
export function parseRequestJson(text: string): ProjectRequest {
  const bytes = encoder.encode(text).length;
  if (bytes > LIMITS.requestBytes) {
    throw new LaunchbedError(
      "LIMIT_EXCEEDED",
      `Request body is ${bytes} bytes; the limit is ${LIMITS.requestBytes} bytes.`,
    );
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new LaunchbedError("INVALID_REQUEST", "Request body must be valid JSON.");
  }
  return parseRequest(json);
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}

export function requestHash(request: ProjectRequest): string {
  return createHash("sha256").update(stableStringify(request)).digest("hex");
}

function sha256(data: Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

export function isExecutablePath(path: string): boolean {
  return path === "gradlew" || (path.startsWith("scripts/") && path.endsWith(".sh"));
}

function homeRoute(addonIds: ReadonlySet<string>): string {
  return homeRouteFor(addonIds);
}

export { TOP_LEVEL_DESTINATIONS, topLevelDestinations, type TopLevelDestination };

function topLevelVars(addonIds: ReadonlySet<string>): Record<string, string> {
  const destinations = topLevelDestinations(addonIds);
  const icons = [...new Set(destinations.map((destination) => destination.icon))].sort();
  return {
    topLevelRoutes: destinations.map((destination) => `AppRoute.${destination.route}`).join(", "),
    topLevelLabelBranches: destinations
      .map((destination) => `    AppRoute.${destination.route} -> ${JSON.stringify(destination.label)}\n`)
      .join(""),
    topLevelIconBranches: destinations
      .map((destination) => `    AppRoute.${destination.route} -> Icons.Filled.${destination.icon}\n`)
      .join(""),
    topLevelIconImports:
      icons.length > 0
        ? ["import androidx.compose.material.icons.Icons", ...icons.map((icon) => `import androidx.compose.material.icons.filled.${icon}`)].join("\n") + "\n"
        : "",
  };
}

function startRouteParts(addonIds: ReadonlySet<string>, packageName: string): { imports: string; body: string } {
  const imports: string[] = [];
  const body: string[] = [];
  if (addonIds.has("ui/onboarding")) {
    imports.push("import androidx.compose.runtime.produceState");
    imports.push("import androidx.compose.ui.platform.LocalContext");
    imports.push(`import ${packageName}.ui.onboarding.OnboardingStore`);
    body.push("    val context = LocalContext.current");
    body.push("    val onboardingSeen = produceState<Boolean?>(initialValue = null, context) {");
    body.push("        OnboardingStore.seen(context).collect { value = it }");
    body.push("    }.value");
    body.push("    if (onboardingSeen == null) return null");
    body.push("    if (!onboardingSeen) return AppRoute.Onboarding");
  }
  if (addonIds.has("ui/auth")) {
    imports.push("import androidx.lifecycle.compose.collectAsStateWithLifecycle");
    imports.push(`import ${packageName}.ui.auth.AuthRepositoryHolder`);
    body.push("    val session = AuthRepositoryHolder.repository.session.collectAsStateWithLifecycle().value");
    body.push("    if (!session.ready) return null");
    body.push("    if (session.user == null) return AppRoute.Login");
  }
  imports.sort((a, b) => a.localeCompare(b));
  return {
    imports: imports.length > 0 ? `${imports.join("\n")}\n` : "",
    body: body.length > 0 ? `${body.join("\n")}\n` : "",
  };
}

function buildTemplateVars(request: ProjectRequest, tokens: ThemeTokens, resolvedAddonIds: readonly string[] = request.addons): TemplateVars {
  const darkThemeDefault =
    request.theme.defaultMode === "system"
      ? "isSystemInDarkTheme()"
      : request.theme.defaultMode === "dark"
        ? "true"
        : "false";

  const addonIds = new Set(resolvedAddonIds);
  const hasNavigation = addonIds.has("ui/navigation");
  const initialRoute = homeRoute(addonIds);
  const afterOnboardingRoute = addonIds.has("ui/auth") ? "Login" : initialRoute;
  const startRoute = startRouteParts(addonIds, request.packageName!);

  return {
    hasNavigation: String(hasNavigation),
    initialRoute,
    afterOnboardingRoute,
    startRouteImports: startRoute.imports,
    startRouteBody: startRoute.body,
    ...topLevelVars(addonIds),
    projectName: request.projectName,
    applicationId: request.applicationId,
    namespace: request.namespace,
    packageName: request.packageName!,
    packagePath: request.packageName!.split(".").join("/"),
    minSdk: String(request.minSdk),
    compileSdk: String(request.compileSdk),
    targetSdk: String(request.targetSdk),
    compileSdkPackage: sdkPlatformPackage(request.compileSdk),
    buildToolsVersion: TOOLCHAIN.buildTools,
    gradleVersion: TOOLCHAIN.gradle,
    agpVersion: TOOLCHAIN.agp,
    kotlinVersion: TOOLCHAIN.kotlin,
    composeBomVersion: TOOLCHAIN.composeBom,
    activityComposeVersion: TOOLCHAIN.activityCompose,
    junitVersion: TOOLCHAIN.junit,
    darkThemeDefault,
    iconBackground: tokens.light.primary,
  };
}

function addFile(
  files: Map<string, Uint8Array>,
  origins: Map<string, "template" | "generated" | "addon" | "overlay">,
  path: string,
  data: Uint8Array,
  origin: "template" | "generated" | "addon" | "overlay",
): void {
  const problems = validateRelativePath(path, `${origin} path`);
  if (problems.length > 0) {
    throw new LaunchbedError("SECURITY_ERROR", problems.join("; "));
  }
  if (files.has(path)) {
    throw new LaunchbedError("TEMPLATE_ERROR", `Two sources produce the same file: ${path}`);
  }
  if (data.length > MAX_FILE_BYTES) {
    throw new LaunchbedError(
      "LIMIT_EXCEEDED",
      `Generated file ${path} is larger than the per-file limit of ${MAX_FILE_BYTES} bytes.`,
    );
  }
  files.set(path, data);
  origins.set(path, origin);
}

function decodeEmbedded(file: { encoding: "utf8" | "base64"; content: string }): Uint8Array {
  if (file.encoding === "utf8") return encoder.encode(file.content);
  return new Uint8Array(Buffer.from(file.content, "base64"));
}
export interface EngineOptions {
  addons?: readonly AddonManifest[];
  fragments?: Readonly<Record<string, string>>;
}

export async function materializeProject(
  input: ProjectRequestInput | ProjectRequest,
  options: EngineOptions = {},
): Promise<MaterializedProject> {
  const request = parseRequest(input);
  const preset = request.preset ? findPreset(request.preset) : undefined;
  if (request.preset && !preset) {
    throw new LaunchbedError("INVALID_REQUEST", `Unknown project preset "${request.preset}".`);
  }
  if (preset && !isPresetGeneratable(preset)) {
    throw new LaunchbedError("RESOLUTION_ERROR", `Preset "${preset.id}" is ${preset.status} and cannot be generated yet.`);
  }
  const presetAddons = preset ? presetAddonsForTarget(preset, request.target) : [];
  if (preset && presetAddons === undefined) {
    throw new LaunchbedError(
      "INCOMPATIBLE_ADDON",
      `Preset "${preset.id}" does not apply to the ${request.target} target. It supports: ${preset.targets.join(", ")}.`,
      [{ path: "preset", message: `${preset.id} supports ${preset.targets.join(", ")}` }],
    );
  }
  const defaultTheme = ThemeConfigSchema.parse({});
  const resolvedRequest = preset
    ? {
        ...request,
        addons: [...new Set([...(presetAddons ?? []), ...request.addons])].sort(),
        theme:
          JSON.stringify(request.theme) === JSON.stringify(defaultTheme)
            ? preset.defaultTheme
            : request.theme,
      }
    : request;
  if (resolvedRequest.themeId) {
    const themePreset = findThemePreset(resolvedRequest.themeId);
    if (!themePreset) {
      throw new LaunchbedError("INVALID_REQUEST", `Unknown theme "${resolvedRequest.themeId}". Run launchbed catalog --json for the theme ids.`, [
        { path: "themeId", message: `unknown theme ${resolvedRequest.themeId}` },
      ]);
    }
    resolvedRequest.theme = applyThemePreset(themePreset, resolvedRequest.theme);
  }
  const resolution = resolveAddons(resolvedRequest, options.addons ?? ALL_ADDONS, { baseJdk: TOOLCHAIN.jdk });
  const tokens = resolveThemeTokens(resolvedRequest.theme);
  const dtcg = themeTokensToDtcg(tokens);
  const compiled = await compileDesignTokens(dtcg, { packageName: resolvedRequest.packageName! });
  if (resolvedRequest.target === "expo" || resolvedRequest.target === "flutter") {
    return materializeDelegateProject(resolvedRequest, resolution.addons, resolution.warnings, compiled, dtcg);
  }
  const vars = buildTemplateVars(resolvedRequest, tokens, resolution.addons.map((addon) => addon.id));
  const files = new Map<string, Uint8Array>();
  const origins = new Map<string, "template" | "generated" | "addon" | "overlay">();

  for (const [templatePath, file] of Object.entries(TEMPLATE_FILES)) {
    const path = renderText(templatePath, vars, `template path ${templatePath}`);
    const bytes = decodeEmbedded(file);
    if (file.encoding === "base64") {
      addFile(files, origins, path, bytes, "template");
    } else {
      const rendered = renderText(file.content, vars, path);
      addFile(files, origins, path, encoder.encode(rendered), "template");
    }
  }

  const sourceRoot = `app/src/main/java/${vars.packagePath}`;
  // Style Dictionary compiles the DTCG document at generator time (not in the app).
  addFile(files, origins, "design-tokens.json", encoder.encode(serializeDtcg(dtcg)), "generated");
  addFile(files, origins, `${sourceRoot}/ui/theme/GeneratedColors.kt`, encoder.encode(compiled.composeColors), "generated");
  addFile(files, origins, `${sourceRoot}/ui/theme/GeneratedTokens.kt`, encoder.encode(compiled.composeTokens), "generated");
  addFile(files, origins, "tokens/tokens.css", encoder.encode(compiled.css), "generated");
  addFile(files, origins, "tokens/tokens.dart", encoder.encode(compiled.flutter), "generated");

  const composition = applyComposition(
    resolution.addons,
    files,
    origins,
    vars,
    options.fragments,
  );

  applyTooling(files, resolution.addons);

  const projectConfig: LaunchbedProjectConfig = {
    schemaVersion: 1,
    target: "android-compose",
    projectName: resolvedRequest.projectName,
    applicationId: resolvedRequest.applicationId,
    packageName: resolvedRequest.packageName!,
    addons: resolution.addons.map((addon) => addon.id),
    components: [],
  };
  addFile(files, origins, LAUNCHBED_PROJECT_FILE, encoder.encode(projectConfigJson(projectConfig)), "generated");

  if (files.size > LIMITS.files) {
    throw new LaunchbedError("LIMIT_EXCEEDED", `Generated ${files.size} files; the limit is ${LIMITS.files}.`);
  }

  const paths = [...files.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  let totalBytes = 0;
  const plannedFiles = paths.map((path) => {
    const data = files.get(path)!;
    totalBytes += data.length;
    return {
      path,
      size: data.length,
      sha256: sha256(data),
      origin: origins.get(path) ?? ("template" as const),
    };
  });

  if (totalBytes > LIMITS.totalBytes) {
    throw new LaunchbedError(
      "LIMIT_EXCEEDED",
      `Generated project is ${totalBytes} bytes; the limit is ${LIMITS.totalBytes}.`,
    );
  }

  const warnings = [...resolution.warnings];

  const plan: GenerationPlan = {
    schemaVersion: GENERATION_SCHEMA_VERSION,
    template: { id: TEMPLATE_ID, version: TEMPLATE_VERSION },
    target: "android-compose",
    strategy: "owned",
    request: {
      hash: requestHash(resolvedRequest),
      projectName: resolvedRequest.projectName,
      applicationId: resolvedRequest.applicationId,
      namespace: resolvedRequest.namespace,
      packageName: resolvedRequest.packageName!,
      minSdk: resolvedRequest.minSdk,
      compileSdk: resolvedRequest.compileSdk,
      targetSdk: resolvedRequest.targetSdk,
      addons: resolution.addons.map((addon) => addon.id),
      preset: resolvedRequest.preset,
      ...(resolvedRequest.themeId ? { themeId: resolvedRequest.themeId } : {}),
      target: "android-compose",
    },
    steps: [],
    files: plannedFiles,
    operations: composition.operations,
    totals: { files: plannedFiles.length, bytes: totalBytes },
    warnings,
  };

  return { plan, files, warnings };
}


/** Setup notes shipped at the root of every delegated project and overlay ZIP. */
export const OVERLAY_README = "LAUNCHBED_OVERLAY.md";

const TARGET_LABELS: Record<string, string> = { expo: "Expo", flutter: "Flutter" };

function overlayReadme(
  request: ProjectRequest,
  addons: readonly AddonManifest[],
  material: { target: string; step: DelegateStep; extraSteps: readonly DelegateStep[]; warnings: readonly string[] },
): string {
  const label = TARGET_LABELS[material.target] ?? material.target;
  const zipFileName = overlayZipFileName(request.projectName);
  const manual = delegateSetupCommands({ target: material.target, step: material.step, zipFileName, extraSteps: material.extraSteps });
  const cli = formatNewCommand({
    projectName: request.projectName,
    applicationId: request.applicationId,
    preset: request.preset,
    addons: request.preset ? [] : addons.map((addon) => addon.id),
    target: material.target,
  });
  return [
    `# ${request.projectName}: Launchbed overlay for ${label}`,
    "",
    `This project starts from the official ${label} template and adds Launchbed files on top`,
    "(design tokens, registry components, screens, mise, just, CI). The official files come from",
    "the official CLI; Launchbed never re-hosts them.",
    "",
    "## With the Launchbed CLI",
    "",
    "One command runs the official CLI and applies these overlays:",
    "",
    "```sh",
    cli,
    "```",
    "",
    "## Without the Launchbed CLI",
    "",
    `Run the official command, then unzip \`${zipFileName}\` over the new project`,
    "(`-o` lets the overlays replace the official files listed below):",
    "",
    "```sh",
    ...manual,
    "```",
    "",
    "Then run `mise install`; `just --list` shows the recipes.",
    "",
    "## Notes",
    "",
    ...material.warnings.map((warning) => `- ${warning}`),
    "",
  ].join("\n");
}

function materializeDelegateProject(
  request: ProjectRequest,
  addons: readonly AddonManifest[],
  resolutionWarnings: readonly string[],
  compiled: Awaited<ReturnType<typeof compileDesignTokens>>,
  dtcg: ReturnType<typeof themeTokensToDtcg>,
): MaterializedProject {
  const material =
    request.target === "flutter"
      ? buildFlutterDelegate({
          projectName: request.projectName,
          applicationId: request.applicationId,
          packageName: request.packageName!,
          addons,
          tokens: compiled,
        })
      : buildExpoDelegate({
          projectName: request.projectName,
          applicationId: request.applicationId,
          packageName: request.packageName!,
          addons,
          tokens: compiled,
        });
  const files = new Map<string, Uint8Array>();
  const origins = new Map<string, "template" | "generated" | "addon" | "overlay">();
  addFile(files, origins, "design-tokens.json", encoder.encode(serializeDtcg(dtcg)), "overlay");
  addFile(files, origins, OVERLAY_README, encoder.encode(overlayReadme(request, addons, material)), "overlay");
  for (const overlay of material.overlays) {
    addFile(files, origins, overlay.path, encoder.encode(overlay.contents), "overlay");
  }
  const paths = [...files.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  let totalBytes = 0;
  const plannedFiles = paths.map((path) => {
    const data = files.get(path)!;
    totalBytes += data.length;
    return { path, size: data.length, sha256: sha256(data), origin: origins.get(path) ?? ("overlay" as const) };
  });
  const plan: GenerationPlan = {
    schemaVersion: GENERATION_SCHEMA_VERSION,
    template: { id: material.templateId, version: material.templateVersion },
    target: material.target,
    strategy: "delegate",
    request: {
      hash: requestHash(request),
      projectName: request.projectName,
      applicationId: request.applicationId,
      namespace: request.namespace,
      packageName: request.packageName!,
      minSdk: request.minSdk,
      compileSdk: request.compileSdk,
      targetSdk: request.targetSdk,
      addons: addons.map((addon) => addon.id),
      preset: request.preset,
      ...(request.themeId ? { themeId: request.themeId } : {}),
      target: material.target,
    },
    steps: [material.step, ...material.extraSteps],
    files: plannedFiles,
    operations: [],
    totals: { files: plannedFiles.length, bytes: totalBytes },
    warnings: [...resolutionWarnings, ...material.warnings],
  };
  return { plan, files, warnings: plan.warnings };
}

export async function createPlan(
  input: ProjectRequestInput | ProjectRequest,
  options: EngineOptions = {},
): Promise<GenerationPlan> {
  return (await materializeProject(input, options)).plan;
}

export interface GeneratedProject {
  zip: Uint8Array;
  plan: GenerationPlan;
  fileName: string;
}

/**
 * Verifies that the ZIP contains exactly the files announced by the plan,
 * with identical bytes, and that executable bits are normalized.
 */
export function verifyZipAgainstPlan(zip: Uint8Array, plan: GenerationPlan): void {
  const entries = readZip(zip);
  if (entries.length !== plan.files.length) {
    throw new LaunchbedError(
      "ZIP_ERROR",
      `ZIP has ${entries.length} files but the plan announces ${plan.files.length}.`,
    );
  }
  const byPath = new Map(entries.map((entry) => [entry.path, entry]));
  for (const planned of plan.files) {
    const entry = byPath.get(planned.path);
    if (!entry) {
      throw new LaunchbedError("ZIP_ERROR", `Planned file is missing from the ZIP: ${planned.path}`);
    }
    if (entry.size !== planned.size) {
      throw new LaunchbedError("ZIP_ERROR", `Size mismatch for ${planned.path}.`);
    }
    if (sha256(entry.data) !== planned.sha256) {
      throw new LaunchbedError("ZIP_ERROR", `Content hash mismatch for ${planned.path}.`);
    }
    if (entry.executable !== isExecutablePath(planned.path)) {
      throw new LaunchbedError("ZIP_ERROR", `Unexpected executable bit for ${planned.path}.`);
    }
  }
}

/** Request -> validate -> resolve -> plan -> render -> package. */
export async function generateProject(
  input: ProjectRequestInput | ProjectRequest,
  options: EngineOptions = {},
): Promise<GeneratedProject> {
  const { plan, files } = await materializeProject(input, options);
  const entries = [...files.entries()].map(([path, data]) => ({
    path,
    data,
    executable: isExecutablePath(path),
  }));
  const zip = createZip(entries);
  verifyZipAgainstPlan(zip, plan);
  return {
    zip,
    plan,
    fileName: plan.strategy === "delegate" ? overlayZipFileName(plan.request.projectName) : `${projectSlug(plan.request.projectName)}.zip`,
  };
}

const SWATCH_ROLES = ["primary", "secondaryContainer", "surfaceVariant", "background", "onBackground"] as const;

/** Catalog with the imported theme presets (ids for themeId / --theme, swatches for pickers). */
export function getCatalog(): CatalogResponse {
  return {
    ...buildCatalog(),
    themes: THEME_PRESETS.map((preset) => ({
      id: preset.id,
      label: preset.label,
      license: preset.source.license,
      source: `${preset.source.repository}@${preset.source.commit.slice(0, 7)}`,
      cornerRadius: preset.cornerRadius,
      fontFamily: preset.fontFamily,
      swatches: {
        light: SWATCH_ROLES.map((role) => preset.light[role] ?? "#000000"),
        dark: SWATCH_ROLES.map((role) => preset.dark[role] ?? "#000000"),
      },
    })),
  };
}
