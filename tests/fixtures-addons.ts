import { stableAddon } from "./fixtures";

export const fixtureFragments: Record<string, string> = {
  "fixtures/screen.txt": `package {{packageName}}.ui

// Added by a trusted test addon.
internal const val FIXTURE_SCREEN = "{{projectName}}"
`,
  "fixtures/alpha-line.txt": `    implementation(libs.fixture.alpha)`,
  "fixtures/beta-line.txt": `    implementation(libs.fixture.beta)`,
  "fixtures/appcompat-line.txt": `    implementation(libs.fixture.appcompat)`,
};

export const fixtureAddons = [
  stableAddon("ui/fixture-alpha", {
    fileOperations: [
      { type: "add", path: "app/src/main/java/{{packagePath}}/ui/FixtureAlpha.kt", template: "fixtures/screen" },
      { type: "merge", target: "version-catalog", alias: "fixture-alpha", module: "androidx.core:core-ktx", version: "1.17.0" },
      { type: "merge", target: "app-dependencies", alias: "fixture-alpha" },
      { type: "insert", path: "app/build.gradle.kts", slot: "app-dependencies", template: "fixtures/alpha-line" },
    ],
  }),
  stableAddon("ui/fixture-beta", {
    fileOperations: [
      { type: "merge", target: "version-catalog", alias: "fixture-beta", module: "androidx.appcompat:appcompat", versionRef: "composeBom" },
      { type: "merge", target: "app-plugins", alias: "fixture-beta" },
      { type: "insert", path: "app/build.gradle.kts", slot: "app-dependencies", template: "fixtures/beta-line" },
    ],
  }),
  stableAddon("tooling/fixture-settings", {
    fileOperations: [
      { type: "merge", target: "settings-includes", module: ":feature:home" },
      { type: "merge", target: "root-plugins", alias: "fixture-beta" },
    ],
  }),
];

export const conflictingAddon = stableAddon("storage/fixture-conflict", {
  fileOperations: [
    { type: "merge", target: "version-catalog", alias: "fixture-alpha", module: "androidx.core:core", version: "9.9.9" },
  ],
});

export const duplicateAddon = stableAddon("storage/fixture-duplicate", {
  fileOperations: [
    { type: "merge", target: "version-catalog", alias: "fixture-alpha", module: "androidx.core:core-ktx", version: "1.17.0" },
    { type: "merge", target: "app-dependencies", alias: "fixture-alpha" },
  ],
});

export const staleSlotAddon = stableAddon("storage/fixture-stale", {
  fileOperations: [
    { type: "insert", path: "app/build.gradle.kts", slot: "app-dependencies", template: "fixtures/alpha-line" },
  ],
});

export const allFixtureAddons = [...fixtureAddons, conflictingAddon, duplicateAddon, staleSlotAddon];
