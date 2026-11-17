import { Appearance, Platform, useColorScheme } from "react-native";
import { tokens } from "../../tokens/tokens";
import type { AppearancePreference } from "./storage/session-state";

export interface AppColors {
  background: string;
  surface: string;
  surfaceVariant: string;
  onSurface: string;
  onSurfaceVariant: string;
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  outline: string;
  outlineVariant: string;
  error: string;
}

const light: AppColors = {
  background: tokens.colorLightBackground,
  surface: tokens.colorLightSurface,
  surfaceVariant: tokens.colorLightSurfaceVariant,
  onSurface: tokens.colorLightOnSurface,
  onSurfaceVariant: tokens.colorLightOnSurfaceVariant,
  primary: tokens.colorLightPrimary,
  onPrimary: tokens.colorLightOnPrimary,
  primaryContainer: tokens.colorLightPrimaryContainer,
  onPrimaryContainer: tokens.colorLightOnPrimaryContainer,
  secondaryContainer: tokens.colorLightSecondaryContainer,
  onSecondaryContainer: tokens.colorLightOnSecondaryContainer,
  outline: tokens.colorLightOutline,
  outlineVariant: tokens.colorLightOutlineVariant,
  error: tokens.colorLightError,
};

const dark: AppColors = {
  background: tokens.colorDarkBackground,
  surface: tokens.colorDarkSurface,
  surfaceVariant: tokens.colorDarkSurfaceVariant,
  onSurface: tokens.colorDarkOnSurface,
  onSurfaceVariant: tokens.colorDarkOnSurfaceVariant,
  primary: tokens.colorDarkPrimary,
  onPrimary: tokens.colorDarkOnPrimary,
  primaryContainer: tokens.colorDarkPrimaryContainer,
  onPrimaryContainer: tokens.colorDarkOnPrimaryContainer,
  secondaryContainer: tokens.colorDarkSecondaryContainer,
  onSecondaryContainer: tokens.colorDarkOnSecondaryContainer,
  outline: tokens.colorDarkOutline,
  outlineVariant: tokens.colorDarkOutlineVariant,
  error: tokens.colorDarkError,
};

/** Whether the app can override the system scheme. On web the browser decides. */
export const canOverrideAppearance = Platform.OS !== "web" && typeof Appearance.setColorScheme === "function";

/** Applies the saved preference app-wide (registry components follow useColorScheme too). */
export function applyAppearance(preference: AppearancePreference): void {
  if (!canOverrideAppearance) return;
  Appearance.setColorScheme(preference === "system" ? "unspecified" : preference);
}

export function useIsDark(): boolean {
  return useColorScheme() === "dark";
}

/** Material color roles from the generated DTCG tokens, for the active light or dark scheme. */
export function useAppColors(): AppColors {
  return useIsDark() ? dark : light;
}
