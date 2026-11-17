import { tokens } from "../../tokens/tokens";

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
  outlineVariant: tokens.colorLightOutlineVariant,
  error: tokens.colorLightError,
};

/**
 * Material color roles from the generated DTCG tokens. The registry components are
 * light-only today, so the screen pack stays on the light scheme for legible contrast.
 */
export function useAppColors(): AppColors {
  return light;
}
