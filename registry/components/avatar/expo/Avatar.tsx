import { Text, View } from "react-native";
import { tokens } from "../../tokens/tokens";

export type AvatarSize = "sm" | "md" | "lg";

export interface AvatarProps {
  initials: string;
  label: string;
  size?: AvatarSize;
}

const DIAMETER: Record<AvatarSize, number> = { sm: 28, md: 40, lg: 64 };
const FONT: Record<AvatarSize, number> = { sm: 11, md: 14, lg: 22 };

export function Avatar({ initials, label, size = "md" }: AvatarProps) {
  const diameter = DIAMETER[size];
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={{
        width: diameter,
        height: diameter,
        borderRadius: diameter / 2,
        backgroundColor: tokens.colorLightPrimaryContainer,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: tokens.colorLightOnPrimaryContainer, fontSize: FONT[size], fontWeight: "600" }}>
        {initials.slice(0, 2).toUpperCase()}
      </Text>
    </View>
  );
}
