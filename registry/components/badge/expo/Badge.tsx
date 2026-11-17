import { Text, View } from "react-native";
import { tokens } from "../../tokens/tokens";

export type BadgeVariant = "neutral" | "accent";

export interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
}

export function Badge({ label, variant = "neutral" }: BadgeProps) {
  const accent = variant === "accent";
  return (
    <View
      accessibilityLabel={label}
      style={{
        alignSelf: "flex-start",
        backgroundColor: accent ? tokens.colorLightPrimary : tokens.colorLightSurfaceVariant,
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 2,
      }}
    >
      <Text style={{ color: accent ? tokens.colorLightOnPrimary : tokens.colorLightOnSurfaceVariant }}>{label}</Text>
    </View>
  );
}
