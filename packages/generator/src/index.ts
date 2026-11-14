export {
  createPlan,
  generateProject,
  getCatalog,
  isExecutablePath,
  materializeProject,
  parseRequest,
  parseRequestJson,
  requestHash,
  stableStringify,
  verifyZipAgainstPlan,
  type EngineOptions,
  type GeneratedProject,
  type MaterializedProject,
} from "./plan";
export { createZip, crc32, readZip, type ZipEntry, type ZipInput } from "./zip";
export { renderText, type TemplateVars } from "./render";
export { TOOLCHAIN, sdkPlatformPackage } from "./versions";
export { TEMPLATE_FILES, FRAGMENT_FILES, TEMPLATE_ID, TEMPLATE_VERSION } from "./templates.generated";
export { applyComposition, type CompositionResult } from "./composition";
export { insertIntoSlot, validateSlotLayout, SLOT_MARKER_PREFIX } from "./slots";
export { mergeVersionCatalog, parseToml, serializeCatalog, type CatalogEntry } from "./version-catalog";
export { ALL_PRESETS, findPreset, isPresetGeneratable } from "@android-initializr/catalog";
