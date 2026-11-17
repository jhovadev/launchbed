import { Pressable, Text, View } from "react-native";
import { tokens } from "../../tokens/tokens";

export interface ListItemProps {
  title: string;
  subtitle?: string;
  onPress?: () => void;
  disabled?: boolean;
}

export function ListItem({ title, subtitle, onPress, disabled = false }: ListItemProps) {
  const content = (
    <View style={{ paddingVertical: 12, paddingHorizontal: 16, opacity: disabled ? 0.5 : 1 }}>
      <Text style={{ color: tokens.colorLightOnSurface }}>{title}</Text>
      {subtitle ? <Text style={{ color: tokens.colorLightOnSurfaceVariant }}>{subtitle}</Text> : null}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityHint={subtitle} disabled={disabled} onPress={onPress}>
      {content}
    </Pressable>
  );
}
