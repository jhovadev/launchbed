import { Pressable, Text, View } from "react-native";
import { tokens } from "../../tokens/tokens";

export interface AppBarProps {
  title: string;
  onBack?: () => void;
}

export function AppBar({ title, onBack }: AppBarProps) {
  return (
    <View
      accessibilityRole="header"
      style={{
        minHeight: 56,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 16,
        backgroundColor: tokens.colorLightSurface,
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
          <Text style={{ fontSize: 22, color: tokens.colorLightOnSurface }}>←</Text>
        </Pressable>
      ) : null}
      <Text numberOfLines={1} style={{ flex: 1, fontSize: 20, fontWeight: "500", color: tokens.colorLightOnSurface }}>
        {title}
      </Text>
    </View>
  );
}
