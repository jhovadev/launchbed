import {
  ProjectPresetManifestSchema,
  type ProjectPresetManifest,
} from "@launchbed/schema";

import composeMinimal from "../../../presets/compose-minimal.json";
import composeStarter from "../../../presets/compose-starter.json";
import localNotes from "../../../presets/local-notes.json";
import catalogUi from "../../../presets/catalog-ui.json";
import inventoryOffline from "../../../presets/inventory-offline.json";
import appStarter from "../../../presets/app-starter.json";
import offlineReader from "../../../presets/offline-reader.json";
import mediaPlayer from "../../../presets/media-player.json";
import clientServer from "../../../presets/client-server.json";

const RAW = [
  composeMinimal,
  composeStarter,
  localNotes,
  catalogUi,
  inventoryOffline,
  appStarter,
  offlineReader,
  mediaPlayer,
  clientServer,
];

export const ALL_PRESETS: readonly ProjectPresetManifest[] = Object.freeze(
  RAW.map((raw) => ProjectPresetManifestSchema.parse(raw)),
);

export function findPreset(id: string): ProjectPresetManifest | undefined {
  return ALL_PRESETS.find((preset) => preset.id === id);
}

export function isPresetGeneratable(preset: ProjectPresetManifest): boolean {
  return preset.status === "stable" || preset.status === "beta";
}
