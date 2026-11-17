/**
 * Multi-target registry. android-compose is the default owned target and stays
 * the implicit value of ProjectRequest.target for backward compatibility.
 */
export const TARGET_IDS = ["android-compose", "expo", "flutter", "tauri-solid"] as const;
export type TargetId = (typeof TARGET_IDS)[number];

export const DEFAULT_TARGET: TargetId = "android-compose";

export const TARGET_STRATEGIES = ["owned", "delegate"] as const;
export type TargetStrategy = (typeof TARGET_STRATEGIES)[number];

export interface TargetPrerequisite {
  id: string;
  label: string;
  optional: boolean;
}

export interface TargetDefinition {
  id: TargetId;
  displayName: string;
  strategy: TargetStrategy;
  status: "stable" | "beta" | "experimental" | "planned";
  /** Official CLI name for delegate targets; omitted for owned templates. */
  officialCli?: string;
  prereqs: readonly TargetPrerequisite[];
  notes: readonly string[];
}

export const TARGETS: readonly TargetDefinition[] = [
  {
    id: "android-compose",
    displayName: "Android (Kotlin + Jetpack Compose)",
    strategy: "owned",
    status: "stable",
    prereqs: [
      { id: "jdk", label: "JDK 21 (Temurin)", optional: false },
      { id: "android-sdk", label: "Android SDK (platform 37.0, build-tools 36.0.0, platform-tools)", optional: false },
      { id: "just", label: "just", optional: true },
      { id: "mise", label: "mise", optional: true },
    ],
    notes: ["Owned Launchbed templates. Plan/ZIP parity is enforced."],
  },
  {
    id: "expo",
    displayName: "Expo (React Native)",
    strategy: "delegate",
    status: "beta",
    officialCli: "create-expo-app",
    prereqs: [
      { id: "node", label: "Node.js ^22.13 || ^24.3 || ^26 || >=27 (Expo SDK 58)", optional: false },
      { id: "npx", label: "npx (npm)", optional: false },
      { id: "just", label: "just", optional: true },
      { id: "mise", label: "mise", optional: true },
    ],
    notes: [
      "Delegates to npx create-expo-app@5.0.0 --template default@sdk-58, then applies Launchbed overlays.",
      "The web API never runs the official CLI; only `launchbed new` executes it.",
    ],
  },
  {
    id: "flutter",
    displayName: "Flutter",
    strategy: "delegate",
    status: "beta",
    officialCli: "flutter",
    prereqs: [
      { id: "flutter", label: "Flutter SDK 3.50.0 (pinned via mise)", optional: false },
      { id: "just", label: "just", optional: true },
      { id: "mise", label: "mise", optional: true },
    ],
    notes: [
      "Delegates to flutter create --template app --platforms android,ios,web (SDK 3.50.0), then applies Launchbed overlays.",
      "The web API never runs the official CLI; only `launchbed new` executes it.",
    ],
  },
  {
    id: "tauri-solid",
    displayName: "Tauri 2 + SolidJS",
    strategy: "delegate",
    status: "planned",
    officialCli: "create-tauri-app",
    prereqs: [{ id: "node", label: "Node.js", optional: false }],
    notes: ["Planned. Official CLI would be npm create tauri-app."],
  },
];

export function findTarget(id: string): TargetDefinition | undefined {
  return TARGETS.find((target) => target.id === id);
}

export function isKnownTarget(id: string): id is TargetId {
  return (TARGET_IDS as readonly string[]).includes(id);
}

export function isGeneratableTarget(target: TargetDefinition): boolean {
  return target.status === "stable" || target.status === "beta";
}
