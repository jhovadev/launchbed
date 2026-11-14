/**
 * Single source of truth for the Android toolchain baked into generated projects.
 * Every version below is verified against official sources; see docs/compatibility.md.
 */
export const TOOLCHAIN = {
  agp: "9.5.1",
  gradle: "9.6.0",
  gradleSha256: "bbaeb2fef8710818cf0e261201dab964c572f92b942812df0c3620d62a529a01",
  kotlin: "2.4.10",
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
