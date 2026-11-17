import { Text } from "react-native";
import { Card } from "../../../components/ui/Card";
import { PROJECT_NAME } from "../config";
import { useAppColors } from "../theme";
import { Screen } from "./Screen";

export function WelcomeScreen() {
  const colors = useAppColors();
  return (
    <Screen title={PROJECT_NAME}>
      <Text accessibilityRole="header" style={{ fontSize: 28, fontWeight: "600", color: colors.onSurface }}>Welcome</Text>
      <Card>
        <Text style={{ color: colors.onSurfaceVariant }}>Built with Expo and Launchbed design tokens. Add screens under src/app.</Text>
      </Card>
    </Screen>
  );
}
