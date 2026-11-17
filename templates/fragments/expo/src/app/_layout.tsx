import { DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { SessionProvider } from "../launchbed/session";

// Launchbed screen pack root. Replaces the official template layout; the official
// tab screens are left on disk but are no longer routed (see docs/EXPO.md).
export default function RootLayout() {
  return (
    <ThemeProvider value={DefaultTheme}>
      <SessionProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </SessionProvider>
    </ThemeProvider>
  );
}
