import 'package:material_ui/material_ui.dart';

import '../tokens/tokens.dart';

/// Material 3 themes built from the generated DTCG tokens.
ThemeData launchbedTheme(Brightness brightness) {
  final light = brightness == Brightness.light;
  final scheme = ColorScheme(
    brightness: brightness,
    primary: light ? LaunchbedTokens.colorLightPrimary : LaunchbedTokens.colorDarkPrimary,
    onPrimary: light ? LaunchbedTokens.colorLightOnPrimary : LaunchbedTokens.colorDarkOnPrimary,
    primaryContainer: light ? LaunchbedTokens.colorLightPrimaryContainer : LaunchbedTokens.colorDarkPrimaryContainer,
    onPrimaryContainer: light ? LaunchbedTokens.colorLightOnPrimaryContainer : LaunchbedTokens.colorDarkOnPrimaryContainer,
    secondary: light ? LaunchbedTokens.colorLightSecondary : LaunchbedTokens.colorDarkSecondary,
    onSecondary: light ? LaunchbedTokens.colorLightOnSecondary : LaunchbedTokens.colorDarkOnSecondary,
    secondaryContainer: light ? LaunchbedTokens.colorLightSecondaryContainer : LaunchbedTokens.colorDarkSecondaryContainer,
    onSecondaryContainer: light ? LaunchbedTokens.colorLightOnSecondaryContainer : LaunchbedTokens.colorDarkOnSecondaryContainer,
    tertiary: light ? LaunchbedTokens.colorLightTertiary : LaunchbedTokens.colorDarkTertiary,
    onTertiary: light ? LaunchbedTokens.colorLightOnTertiary : LaunchbedTokens.colorDarkOnTertiary,
    tertiaryContainer: light ? LaunchbedTokens.colorLightTertiaryContainer : LaunchbedTokens.colorDarkTertiaryContainer,
    onTertiaryContainer: light ? LaunchbedTokens.colorLightOnTertiaryContainer : LaunchbedTokens.colorDarkOnTertiaryContainer,
    error: light ? LaunchbedTokens.colorLightError : LaunchbedTokens.colorDarkError,
    onError: light ? LaunchbedTokens.colorLightOnError : LaunchbedTokens.colorDarkOnError,
    // Without these, ColorScheme falls back to error/onError and hovered error fields turn white.
    errorContainer: light ? LaunchbedTokens.colorLightErrorContainer : LaunchbedTokens.colorDarkErrorContainer,
    onErrorContainer: light ? LaunchbedTokens.colorLightOnErrorContainer : LaunchbedTokens.colorDarkOnErrorContainer,
    surface: light ? LaunchbedTokens.colorLightSurface : LaunchbedTokens.colorDarkSurface,
    onSurface: light ? LaunchbedTokens.colorLightOnSurface : LaunchbedTokens.colorDarkOnSurface,
    surfaceContainerHighest: light ? LaunchbedTokens.colorLightSurfaceVariant : LaunchbedTokens.colorDarkSurfaceVariant,
    onSurfaceVariant: light ? LaunchbedTokens.colorLightOnSurfaceVariant : LaunchbedTokens.colorDarkOnSurfaceVariant,
    outline: light ? LaunchbedTokens.colorLightOutline : LaunchbedTokens.colorDarkOutline,
    outlineVariant: light ? LaunchbedTokens.colorLightOutlineVariant : LaunchbedTokens.colorDarkOutlineVariant,
    inverseSurface: light ? LaunchbedTokens.colorLightInverseSurface : LaunchbedTokens.colorDarkInverseSurface,
    onInverseSurface: light ? LaunchbedTokens.colorLightInverseOnSurface : LaunchbedTokens.colorDarkInverseOnSurface,
    inversePrimary: light ? LaunchbedTokens.colorLightInversePrimary : LaunchbedTokens.colorDarkInversePrimary,
    surfaceTint: light ? LaunchbedTokens.colorLightSurfaceTint : LaunchbedTokens.colorDarkSurfaceTint,
    scrim: light ? LaunchbedTokens.colorLightScrim : LaunchbedTokens.colorDarkScrim,
  );
  return ThemeData(colorScheme: scheme, useMaterial3: true);
}
