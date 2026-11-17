import { Pressable, Text, View, useColorScheme } from "react-native";
import { tokens } from "../../tokens/tokens";

export interface AppBarProps {
  title: string;
  onBack?: () => void;
}

export function AppBar({ title, onBack }: AppBarProps) {
  const role = useRole();
  return (
    <View
      accessibilityRole="header"
      style={{
        minHeight: 56,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 16,
        backgroundColor: role("Surface"),
      }}
    >
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Navigate back"
          hitSlop={12}
          onPress={onBack}
          style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}
        >
          <Text style={{ fontSize: 22, color: role("OnSurface") }}>←</Text>
        </Pressable>
      ) : null}
      <Text numberOfLines={1} style={{ flex: 1, fontSize: 20, fontWeight: "500", color: role("OnSurface") }}>
        {title}
      </Text>
    </View>
  );
}

type ColorRole = { [K in keyof typeof tokens]: K extends `colorLight${infer R}` ? R : never }[keyof typeof tokens];

/** Light or dark token for a Material color role, following the system color scheme. */
function useRole(): (role: ColorRole) => string {
  const dark = useColorScheme() === "dark";
  return (role) => (dark ? tokens[`colorDark${role}`] : tokens[`colorLight${role}`]);
}
