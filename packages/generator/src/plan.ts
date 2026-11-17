import { createHash } from "node:crypto";
import {
  ALL_ADDONS,
  buildCatalog,
  findPreset,
  isPresetGeneratable,
} from "@android-initializr/catalog";
import { resolveAddons } from "@android-initializr/resolver";
import {
  InitializrError,
  GENERATION_SCHEMA_VERSION,
  LIMITS,
  ProjectRequestSchema,
  ThemeConfigSchema,
  TEMPLATE_ID,
  TEMPLATE_VERSION,
  issuesFromZod,
  normalizeRequest,
  projectSlug,
  validateRelativePath,
  type AddonManifest,
  type CatalogResponse,
  type GenerationPlan,
  type ProjectRequest,
  type ProjectRequestInput,
} from "@android-initializr/schema";
import {
  generateComposeColors,
  generateComposeTokens,
  resolveThemeTokens,
  type ThemeTokens,
} from "@android-initializr/design-tokens";
import { renderText, type TemplateVars } from "./render";
import { FRAGMENT_FILES, TEMPLATE_FILES } from "./templates.generated";
import { TOOLCHAIN, sdkPlatformPackage } from "./versions";
import { createZip, readZip } from "./zip";
import { applyComposition } from "./composition";
import { applyTooling } from "./tooling";

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
    throw new InitializrError("INVALID_REQUEST", "The project request is invalid.", issuesFromZod(result.error));
  }
  return normalizeRequest(result.data);
}

/** Parses and validates a JSON request body, enforcing the request size limit. */
export function parseRequestJson(text: string): ProjectRequest {
  const bytes = encoder.encode(text).length;
  if (bytes > LIMITS.requestBytes) {
    throw new InitializrError(
      "LIMIT_EXCEEDED",
      `Request body is ${bytes} bytes; the limit is ${LIMITS.requestBytes} bytes.`,
    );
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new InitializrError("INVALID_REQUEST", "Request body must be valid JSON.");
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

function buildTemplateVars(request: ProjectRequest, tokens: ThemeTokens): TemplateVars {
  const darkThemeDefault =
    request.theme.defaultMode === "system"
      ? "isSystemInDarkTheme()"
      : request.theme.defaultMode === "dark"
        ? "true"
        : "false";

  const hasNavigation = request.addons.includes("ui/navigation");
  const initialRoute = request.addons.includes("ui/dashboard")
    ? "Dashboard"
    : request.addons.includes("ui/settings")
      ? "Settings"
      : request.addons.includes("ui/notes")
        ? "Notes"
        : request.addons.includes("ui/catalog")
          ? "Catalog"
          : "Welcome";

  return {
    hasNavigation: String(hasNavigation),
    initialRoute,
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
  origins: Map<string, "template" | "generated" | "addon">,
  path: string,
  data: Uint8Array,
  origin: "template" | "generated" | "addon",
): void {
  const problems = validateRelativePath(path, `${origin} path`);
  if (problems.length > 0) {
    throw new InitializrError("SECURITY_ERROR", problems.join("; "));
  }
  if (files.has(path)) {
    throw new InitializrError("TEMPLATE_ERROR", `Two sources produce the same file: ${path}`);
  }
  if (data.length > MAX_FILE_BYTES) {
    throw new InitializrError(
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

export function materializeProject(
  input: ProjectRequestInput | ProjectRequest,
  options: EngineOptions = {},
): MaterializedProject {
  const request = parseRequest(input);
  const preset = request.preset ? findPreset(request.preset) : undefined;
  if (request.preset && !preset) {
    throw new InitializrError("INVALID_REQUEST", `Unknown project preset "${request.preset}".`);
  }
  if (preset && !isPresetGeneratable(preset)) {
    throw new InitializrError("RESOLUTION_ERROR", `Preset "${preset.id}" is ${preset.status} and cannot be generated yet.`);
  }
  const defaultTheme = ThemeConfigSchema.parse({});
  const resolvedRequest = preset
    ? {
        ...request,
        addons: [...new Set([...preset.requiredAddons, ...request.addons])].sort(),
        theme:
          JSON.stringify(request.theme) === JSON.stringify(defaultTheme)
            ? preset.defaultTheme
            : request.theme,
      }
    : request;
  const resolution = resolveAddons(resolvedRequest, options.addons ?? ALL_ADDONS, { baseJdk: TOOLCHAIN.jdk });
  const tokens = resolveThemeTokens(resolvedRequest.theme);
  const vars = buildTemplateVars(resolvedRequest, tokens);
  const files = new Map<string, Uint8Array>();
  const origins = new Map<string, "template" | "generated" | "addon">();

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
  addFile(
    files,
    origins,
    `${sourceRoot}/ui/theme/GeneratedColors.kt`,
    encoder.encode(generateComposeColors(tokens, request.packageName!)),
    "generated",
  );
  addFile(
    files,
    origins,
    `${sourceRoot}/ui/theme/GeneratedTokens.kt`,
    encoder.encode(generateComposeTokens(tokens, request.packageName!)),
    "generated",
  );

  const composition = applyComposition(
    resolution.addons,
    files,
    origins,
    vars,
    options.fragments,
  );

  applyTooling(files, resolution.addons);

  if (files.size > LIMITS.files) {
    throw new InitializrError("LIMIT_EXCEEDED", `Generated ${files.size} files; the limit is ${LIMITS.files}.`);
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
    throw new InitializrError(
      "LIMIT_EXCEEDED",
      `Generated project is ${totalBytes} bytes; the limit is ${LIMITS.totalBytes}.`,
    );
  }

  const warnings = [...resolution.warnings];

  const plan: GenerationPlan = {
    schemaVersion: GENERATION_SCHEMA_VERSION,
    template: { id: TEMPLATE_ID, version: TEMPLATE_VERSION },
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
    },
    files: plannedFiles,
    operations: composition.operations,
    totals: { files: plannedFiles.length, bytes: totalBytes },
    warnings,
  };

  return { plan, files, warnings };
}

export function createPlan(
  input: ProjectRequestInput | ProjectRequest,
  options: EngineOptions = {},
): GenerationPlan {
  return materializeProject(input, options).plan;
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
    throw new InitializrError(
      "ZIP_ERROR",
      `ZIP has ${entries.length} files but the plan announces ${plan.files.length}.`,
    );
  }
  const byPath = new Map(entries.map((entry) => [entry.path, entry]));
  for (const planned of plan.files) {
    const entry = byPath.get(planned.path);
    if (!entry) {
      throw new InitializrError("ZIP_ERROR", `Planned file is missing from the ZIP: ${planned.path}`);
    }
    if (entry.size !== planned.size) {
      throw new InitializrError("ZIP_ERROR", `Size mismatch for ${planned.path}.`);
    }
    if (sha256(entry.data) !== planned.sha256) {
      throw new InitializrError("ZIP_ERROR", `Content hash mismatch for ${planned.path}.`);
    }
    if (entry.executable !== isExecutablePath(planned.path)) {
      throw new InitializrError("ZIP_ERROR", `Unexpected executable bit for ${planned.path}.`);
    }
  }
}

/** Request -> validate -> resolve -> plan -> render -> package. */
export function generateProject(
  input: ProjectRequestInput | ProjectRequest,
  options: EngineOptions = {},
): GeneratedProject {
  const { plan, files } = materializeProject(input, options);
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
    fileName: `${projectSlug(plan.request.projectName)}.zip`,
  };
}

export function getCatalog(): CatalogResponse {
  return buildCatalog();
}
