/**
 * Top-level navigation shared by the generator (Compose bottom bar, Expo tabs, Flutter
 * NavigationBar) and the web preview, so the preview always mirrors the generated app.
 */

/** Screen add-ons that become Compose bottom navigation tabs, in tab order after the home tab. */
export const TOP_LEVEL_DESTINATIONS = [
  { addon: "ui/dashboard", route: "Dashboard", label: "Home", icon: "Home" },
  { addon: "ui/notes", route: "Notes", label: "Notes", icon: "Edit" },
  { addon: "ui/catalog", route: "Catalog", label: "Catalog", icon: "ShoppingCart" },
  { addon: "ui/profile", route: "Profile", label: "Profile", icon: "Person" },
  { addon: "ui/settings", route: "Settings", label: "Settings", icon: "Settings" },
] as const;

export type TopLevelDestination = (typeof TOP_LEVEL_DESTINATIONS)[number];

function idSet(addonIds: ReadonlySet<string> | readonly string[]): ReadonlySet<string> {
  return addonIds instanceof Set ? addonIds : new Set(addonIds as readonly string[]);
}

/** The Compose start destination after onboarding/sign-in. */
export function homeRouteFor(addonIds: ReadonlySet<string> | readonly string[]): string {
  const ids = idSet(addonIds);
  if (ids.has("ui/dashboard")) return "Dashboard";
  if (ids.has("ui/settings")) return "Settings";
  if (ids.has("ui/notes")) return "Notes";
  if (ids.has("ui/catalog")) return "Catalog";
  return "Welcome";
}

/** Compose top-level destinations for a resolved add-on set; the home route always comes first. */
export function topLevelDestinations(addonIds: ReadonlySet<string> | readonly string[]): TopLevelDestination[] {
  const ids = idSet(addonIds);
  const present = TOP_LEVEL_DESTINATIONS.filter((destination) => ids.has(destination.addon));
  const home = homeRouteFor(ids);
  const first = present.find((destination) => destination.route === home);
  return first ? [first, ...present.filter((destination) => destination !== first)] : present;
}

export interface DelegateTab {
  id: "home" | "profile";
  label: string;
}

/** Bottom tabs of the Expo and Flutter screen packs. */
export function delegateTabs(addonIds: ReadonlySet<string> | readonly string[]): DelegateTab[] {
  const ids = idSet(addonIds);
  const tabs: DelegateTab[] = [{ id: "home", label: ids.has("ui/dashboard") ? "Home" : "Welcome" }];
  if (ids.has("ui/profile")) tabs.push({ id: "profile", label: "Profile" });
  return tabs;
}
