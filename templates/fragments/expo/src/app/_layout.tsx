import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SessionProvider } from "../launchbed/session";
import { useAppColors, useIsDark } from "../launchbed/theme";

// Launchbed screen pack root. Replaces the official template layout; the official
// tab screens are left on disk but are no longer routed (see docs/EXPO.md).
export default function RootLayout() {
  const dark = useIsDark();
  const colors = useAppColors();
  const base = dark ? DarkTheme : DefaultTheme;
  const theme = {
    ...base,
    colors: { ...base.colors, primary: colors.primary, background: colors.background, card: colors.surface, text: colors.onSurface, border: colors.outlineVariant },
  };
  return (
    <ThemeProvider value={theme}>
      <SessionProvider>
        <StatusBar style={dark ? "light" : "dark"} />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
      </SessionProvider>
    </ThemeProvider>
  );
}
