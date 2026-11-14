import { createHash } from "node:crypto";
import {
  ALL_ADDONS,
  buildCatalog,
} from "@android-initializr/catalog";
import { resolveAddons } from "@android-initializr/resolver";
import {
  InitializrError,
  GENERATION_SCHEMA_VERSION,
  LIMITS,
  ProjectRequestSchema,
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

  return {
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

/**
 * Applies addon file operations. Only stable/beta addons reach this function
 * (the resolver rejects the rest). `modify` is intentionally not implemented
 * yet: failing loudly is safer than pretending to patch source files.
 */
export function applyAddonOperations(
  addons: readonly AddonManifest[],
  files: Map<string, Uint8Array>,
  origins: Map<string, "template" | "generated" | "addon">,
  vars: TemplateVars,
  fragments: Readonly<Record<string, string>> = FRAGMENT_FILES,
): void {
  for (const addon of addons) {
    for (const operation of addon.fileOperations) {
      const path = renderText(operation.path, vars, `${addon.id} file path`);
      const fragmentKey = `${operation.template}.txt`;
      const fragment = fragments[fragmentKey];
      if (fragment === undefined) {
        throw new InitializrError(
          "TEMPLATE_ERROR",
          `Addon ${addon.id} references missing local fragment "${operation.template}".`,
        );
      }
      const rendered = renderText(fragment, vars, `${addon.id} fragment ${operation.template}`);

      if (operation.type === "add") {
        addFile(files, origins, path, encoder.encode(rendered), "addon");
      } else if (operation.type === "append") {
        const existing = files.get(path);
        if (!existing) {
          throw new InitializrError("TEMPLATE_ERROR", `Addon ${addon.id} appends to missing file ${path}.`);
        }
        const endsWithNewline = existing.length > 0 && existing[existing.length - 1] === 0x0a;
        const addition = encoder.encode(`${endsWithNewline || rendered.startsWith("\n") ? "" : "\n"}${rendered}`);
        const merged = new Uint8Array(existing.length + addition.length);
        merged.set(existing, 0);
        merged.set(addition, existing.length);
        if (merged.length > MAX_FILE_BYTES) {
          throw new InitializrError("LIMIT_EXCEEDED", `Addon ${addon.id} makes ${path} too large.`);
        }
        files.set(path, merged);
      } else {
        throw new InitializrError(
          "TEMPLATE_ERROR",
          `Addon ${addon.id} uses "${operation.type}", which is not implemented in F0.`,
        );
      }
    }
  }
}

/**
 * ProjectRequest -> validate -> resolve -> plan -> render.
 * No timestamps, no randomness, no environment-dependent ordering.
 */
export function materializeProject(input: ProjectRequestInput | ProjectRequest): MaterializedProject {
  const request = parseRequest(input);
  const resolution = resolveAddons(request, ALL_ADDONS, { baseJdk: TOOLCHAIN.jdk });
  const tokens = resolveThemeTokens(request.theme);
  const vars = buildTemplateVars(request, tokens);
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

  applyAddonOperations(resolution.addons, files, origins, vars);

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
      hash: requestHash(request),
      projectName: request.projectName,
      applicationId: request.applicationId,
      namespace: request.namespace,
      packageName: request.packageName!,
      minSdk: request.minSdk,
      compileSdk: request.compileSdk,
      targetSdk: request.targetSdk,
      addons: resolution.addons.map((addon) => addon.id),
    },
    files: plannedFiles,
    totals: { files: plannedFiles.length, bytes: totalBytes },
    warnings,
  };

  return { plan, files, warnings };
}

export function createPlan(input: ProjectRequestInput | ProjectRequest): GenerationPlan {
  return materializeProject(input).plan;
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
export function generateProject(input: ProjectRequestInput | ProjectRequest): GeneratedProject {
  const { plan, files } = materializeProject(input);
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
