export const LIMITS = {
  /** Maximum accepted JSON body for /api/plan and /api/generate. */
  requestBytes: 32 * 1024,
  /** Maximum number of files in a GenerationPlan / ZIP. */
  files: 200,
  /** Maximum total uncompressed bytes of a generated project. */
  totalBytes: 8 * 1024 * 1024,
  /** Maximum selected addons per request. */
  addons: 32,
  /** Maximum length of a relative path inside a generated project. */
  pathLength: 180,
  /** Maximum path depth inside a generated project. */
  pathDepth: 12,
  /** Maximum project name length. */
  projectNameLength: 64,
  /** Maximum addon dependency graph depth. */
  resolutionDepth: 16,
} as const;

export const SDK_LIMITS = {
  minSdk: { min: 24, max: 37 },
  compileSdk: { min: 34, max: 37 },
  targetSdk: { min: 24, max: 37 },
} as const;

/** Android SDK levels supported by the bundled template matrix (documented in docs/compatibility.md). */
export const SUPPORTED_COMPILE_SDKS = [34, 35, 36, 37] as const;
export const DEFAULT_SDK = { min: 26, compile: 37, target: 36 } as const;

export const GENERATION_SCHEMA_VERSION = 1 as const;
export const TEMPLATE_ID = "android-compose-minimal" as const;
export const TEMPLATE_VERSION = "0.1.0" as const;
