import { Pressable, Text, View, useColorScheme } from "react-native";
import { tokens } from "../../tokens/tokens";

export interface ListItemProps {
  title: string;
  subtitle?: string;
  onPress?: () => void;
  disabled?: boolean;
}

export function ListItem({ title, subtitle, onPress, disabled = false }: ListItemProps) {
  const role = useRole();
  const content = (
    <View style={{ paddingVertical: 12, paddingHorizontal: 16, opacity: disabled ? 0.5 : 1 }}>
      <Text style={{ color: role("OnSurface") }}>{title}</Text>
      {subtitle ? <Text style={{ color: role("OnSurfaceVariant") }}>{subtitle}</Text> : null}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityHint={subtitle} disabled={disabled} onPress={onPress}>
      {content}
    </Pressable>
  );
}

type ColorRole = { [K in keyof typeof tokens]: K extends `colorLight${infer R}` ? R : never }[keyof typeof tokens];

/** Light or dark token for a Material color role, following the system color scheme. */
function useRole(): (role: ColorRole) => string {
  const dark = useColorScheme() === "dark";
  return (role) => (dark ? tokens[`colorDark${role}`] : tokens[`colorLight${role}`]);
}
