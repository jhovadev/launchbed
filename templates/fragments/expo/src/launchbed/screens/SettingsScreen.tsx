import { Pressable, Text, View } from "react-native";
import { Card } from "../../../components/ui/Card";
import { ListItem } from "../../../components/ui/ListItem";
import { SwitchRow } from "../../../components/ui/SwitchRow";
import { PROJECT_NAME } from "../config";
import { useSession } from "../session";
import type { AppearancePreference } from "../storage/session-state";
import { canOverrideAppearance, useAppColors } from "../theme";
import { Screen } from "./Screen";

const APPEARANCE: { value: AppearancePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

function SectionTitle({ children }: { children: string }) {
  const colors = useAppColors();
  return (
    <Text accessibilityRole="header" style={{ fontSize: 14, fontWeight: "600", color: colors.primary, marginBottom: -8 }}>
      {children}
    </Text>
  );
}

/** Settings saved on the device: appearance (applied app-wide), notifications preference, about. */
export function SettingsScreen() {
  const session = useSession();
  const colors = useAppColors();
  return (
    <Screen title="Settings">
      <SectionTitle>Appearance</SectionTitle>
      <Card>
        <View accessibilityRole="radiogroup" style={{ flexDirection: "row", borderRadius: 20, borderWidth: 1, borderColor: colors.outline, overflow: "hidden" }}>
          {APPEARANCE.map((option, index) => {
            const selected = session.appearance === option.value;
            const disabled = !canOverrideAppearance && option.value !== "system";
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ selected, disabled }}
                disabled={disabled}
                onPress={() => session.setAppearance(option.value)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  alignItems: "center",
                  backgroundColor: selected ? colors.secondaryContainer : "transparent",
                  borderLeftWidth: index === 0 ? 0 : 1,
                  borderColor: colors.outline,
                  opacity: disabled ? 0.45 : 1,
                }}
              >
                <Text style={{ fontWeight: "600", color: selected ? colors.onSecondaryContainer : colors.onSurface }}>
                  {selected ? "✓ " : ""}
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={{ marginTop: 8, color: colors.onSurfaceVariant }}>
          {canOverrideAppearance ? "Saved on this device." : "On the web the browser's color scheme applies."}
        </Text>
      </Card>
      <SectionTitle>Notifications</SectionTitle>
      <Card>
        <SwitchRow label="Enable notifications" checked={session.notifications} onChange={session.setNotifications} />
        <Text style={{ marginTop: 4, color: colors.onSurfaceVariant }}>A saved preference. Connect it to your notification service.</Text>
      </Card>
      <SectionTitle>About</SectionTitle>
      <Card style={{ padding: 0 }}>
        <ListItem title={PROJECT_NAME} subtitle="Version 1.0.0" />
        <ListItem title="Built with Launchbed" subtitle="Expo screen pack" />
      </Card>
    </Screen>
  );
}
