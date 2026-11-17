import { delegateTabs, topLevelDestinations } from "@launchbed/schema";

export type PreviewScreenId =
  | "welcome"
  | "dashboard"
  | "settings"
  | "notes"
  | "catalog"
  | "onboarding"
  | "login"
  | "register"
  | "profile";

export type PreviewTarget = "android-compose" | "expo" | "flutter";

export type PreviewTabIcon = "home" | "notes" | "catalog" | "profile" | "settings";

export interface PreviewTab {
  screen: PreviewScreenId;
  label: string;
  icon: PreviewTabIcon;
}

const COMPOSE_TAB_SCREENS: Record<string, { screen: PreviewScreenId; icon: PreviewTabIcon }> = {
  Dashboard: { screen: "dashboard", icon: "home" },
  Notes: { screen: "notes", icon: "notes" },
  Catalog: { screen: "catalog", icon: "catalog" },
  Profile: { screen: "profile", icon: "profile" },
  Settings: { screen: "settings", icon: "settings" },
};

/**
 * Bottom navigation the generated app shows for these add-ons: Compose NavigationBar,
 * Expo tabs or Flutter NavigationBar. Same rules as the generator (see @launchbed/schema).
 */
export function previewTabs(target: PreviewTarget, addons: readonly string[]): PreviewTab[] {
  if (!addons.includes("ui/navigation")) return [];
  if (target === "android-compose") {
    return topLevelDestinations(addons).map((destination) => ({ ...COMPOSE_TAB_SCREENS[destination.route]!, label: destination.label }));
  }
  return delegateTabs(addons).map((tab) =>
    tab.id === "home"
      ? { screen: addons.includes("ui/dashboard") ? ("dashboard" as const) : ("welcome" as const), label: tab.label, icon: "home" as const }
      : { screen: tab.id, label: tab.label, icon: tab.id },
  );
}

