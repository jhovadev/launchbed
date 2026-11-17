/**
 * Single source of truth for the Android toolchain baked into generated projects.
 * Every version below is verified against official sources; see docs/compatibility.md.
 */
export const TOOLCHAIN = {
  agp: "9.5.1",
  gradle: "9.6.0",
  gradleSha256: "bbaeb2fef8710818cf0e261201dab964c572f92b942812df0c3620d62a529a01",
  kotlin: "2.3.10",
  composeBom: "2026.09.00",
  activityCompose: "1.13.0",
  junit: "4.13.2",
  /** Build Tools default of AGP 9.5. */
  buildTools: "36.0.0",
  /** JDK required by AGP 9.5 and used by CI. */
  jdk: 21,
} as const;

/**
 * SDK package names changed for API 37: the platform directory is android-37.0.
 */
export function sdkPlatformPackage(compileSdk: number): string {
  return compileSdk >= 37 ? `${compileSdk}.0` : String(compileSdk);
}

/**
 * Pinned mise toolchain written into generated projects.
 * Values come from the verified environment in docs/compatibility.md.
 * The Android SDK is not a mise tool; `just sdk-setup` installs it.
 */
export const GENERATED_MISE = {
  minVersion: "2026.10.13",
  tools: {
    java: "temurin-21.0.13+9.0.LTS",
    just: "1.59.0",
  },
  /** Optional mise tasks are only shortcuts to just recipes. */
  shortcuts: ["doctor", "build", "test", "run"],
} as const;

/** just recipes shipped by the base Android template. Addons may not replace these with a different body. */
export const RESERVED_JUST_RECIPES = [
  "default",
  "doctor",
  "sdk-setup",
  "build",
  "test",
  "lint",
  "devices",
  "install",
  "launch",
  "run",
  "logs",
  "logcat",
  "scrcpy",
  "mirror",
  "mirror-wifi",
  "record",
  "screenshot",
  "clear-data",
  "uninstall",
  "deeplink",
  "clean",
  "apk",
] as const;

/** Verified GitHub Action commit SHAs (annotated tags peeled to the commit). Retrieved 2026-11-16 via git ls-remote. */
export const ACTION_PINS = {
  checkout: { uses: "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1", tag: "v7.0.1" },
  setupJava: { uses: "actions/setup-java@d1374f8ac74474200d16ef8ecee22c7ae7a51880", tag: "v6.3.0" },
  setupNode: { uses: "actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38", tag: "v6.5.0" },
  setupGradle: { uses: "gradle/actions/setup-gradle@8da46b539cd8fe6ab27ca75128919a18d757604c", tag: "v6.4.1" },
  wrapperValidation: { uses: "gradle/actions/wrapper-validation@8da46b539cd8fe6ab27ca75128919a18d757604c", tag: "v6.4.1" },
  setupAndroid: { uses: "android-actions/setup-android@be39fa834029ff78f1a44aa3bb0819b8fc2bd8fd", tag: "v4.0.4" },
  uploadArtifact: { uses: "actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a", tag: "v7.0.1" },
} as const;

/** Official Expo pins, verified against docs.expo.dev/more/create-expo/ and the npm packument on 2026-11-16. */
export const EXPO_PINS = {
  createPackage: "create-expo-app",
  createVersion: "5.0.0",
  template: "default@sdk-58",
  sdk: 58,
  node: "24.22.2",
  bun: "1.4.4",
  templateId: "expo-default",
  templateVersion: "0.1.0",
} as const;

/** Official Flutter pins. Stable 3.50.0 is current as of 2026-11-11; listed by mise ls-remote flutter. */
export const FLUTTER_PINS = {
  sdk: "3.50.0",
  template: "app",
  platforms: "android,ios,web",
  androidLanguage: "kotlin",
  templateId: "flutter-app",
  templateVersion: "0.1.0",
} as const;
