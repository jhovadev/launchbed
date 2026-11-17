import {
  AddonManifestSchema,
  type AddonManifest,
  type CatalogEntry,
  type CatalogResponse,
} from "@launchbed/schema";
import { DEFAULT_SDK, LIMITS, TEMPLATE_ID, TEMPLATE_VERSION } from "@launchbed/schema";

import room from "../../../addons/storage/room.json";
import sqliteDirect from "../../../addons/storage/sqlite-direct.json";
import libsqlAndroid from "../../../addons/storage/libsql-android.json";
import turso from "../../../addons/storage/turso.json";
import sqldRemote from "../../../addons/storage/sqld-remote.json";
import login from "../../../addons/ui/login.json";
import register from "../../../addons/ui/register.json";
import onboarding from "../../../addons/ui/onboarding.json";
import settings from "../../../addons/ui/settings.json";
import dashboard from "../../../addons/ui/dashboard.json";
import navigation from "../../../addons/ui/navigation.json";
import catalog from "../../../addons/ui/catalog.json";
import notes from "../../../addons/ui/notes.json";
import rustFfi from "../../../addons/native/rust-ffi.json";
import zigFfi from "../../../addons/native/zig-ffi.json";
import jniBridge from "../../../addons/native/jni-bridge.json";
import scrcpy from "../../../addons/tooling/scrcpy.json";
import githubActions from "../../../addons/tooling/github-actions.json";
import dockerCompose from "../../../addons/tooling/docker-compose.json";
import androidCli from "../../../addons/tooling/android-cli.json";
import foundationCore from "../../../addons/tooling/foundation-core.json";
import foundationUi from "../../../addons/ui/foundation-ui.json";

const RAW_MANIFESTS = [
  room,
  sqliteDirect,
  libsqlAndroid,
  turso,
  sqldRemote,
  login,
  register,
  onboarding,
  settings,
  dashboard,
  navigation,
  catalog,
  notes,
  rustFfi,
  zigFfi,
  jniBridge,
  scrcpy,
  githubActions,
  dockerCompose,
  androidCli,
  foundationCore,
  foundationUi,
];

const CATEGORY_ORDER: Record<AddonManifest["category"], number> = {
  storage: 0,
  ui: 1,
  native: 2,
  tooling: 3,
  foundation: 4,
};

/**
 * Manifests are validated at module load. An invalid manifest is a build-time
 * defect, not a user error, so it must fail loudly during tests and CI.
 */
export const ALL_ADDONS: readonly AddonManifest[] = Object.freeze(
  RAW_MANIFESTS.map((raw) => AddonManifestSchema.parse(raw)).sort((a, b) => {
    const byCategory = CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category];
    return byCategory !== 0 ? byCategory : a.id.localeCompare(b.id);
  }),
);

export function findAddon(id: string): AddonManifest | undefined {
  return ALL_ADDONS.find((addon) => addon.id === id);
}

export function isGeneratable(addon: AddonManifest): boolean {
  return (addon.status === "stable" || addon.status === "beta") && addon.fileOperations.length > 0;
}

export function toCatalogEntry(addon: AddonManifest): CatalogEntry {
  return {
    id: addon.id,
    version: addon.version,
    displayName: addon.displayName,
    description: addon.description,
    category: addon.category,
    status: addon.status,
    generatable: isGeneratable(addon),
    capabilities: addon.capabilities,
    dependencies: addon.dependencies,
    conflicts: addon.conflicts,
    requirements: addon.requirements,
    compatibility: addon.compatibility,
    license: addon.license,
  };
}

export function buildCatalog(): CatalogResponse {
  return {
    template: {
      id: TEMPLATE_ID,
      version: TEMPLATE_VERSION,
      displayName: "Android Compose Minimal",
      minSdk: DEFAULT_SDK.min,
      compileSdk: DEFAULT_SDK.compile,
      targetSdk: DEFAULT_SDK.target,
    },
    addons: ALL_ADDONS.map(toCatalogEntry),
    limits: {
      requestBytes: LIMITS.requestBytes,
      files: LIMITS.files,
      totalBytes: LIMITS.totalBytes,
      addons: LIMITS.addons,
    },
  };
}

export * from "./presets";
