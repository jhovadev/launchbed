import { Text, View, useColorScheme } from "react-native";
import { tokens } from "../../tokens/tokens";

export type BadgeVariant = "neutral" | "accent";

export interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
}

export function Badge({ label, variant = "neutral" }: BadgeProps) {
  const role = useRole();
  const accent = variant === "accent";
  return (
    <View
      accessibilityLabel={label}
      style={{
        alignSelf: "flex-start",
        backgroundColor: accent ? role("Primary") : role("SurfaceVariant"),
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 2,
      }}
    >
      <Text style={{ color: accent ? role("OnPrimary") : role("OnSurfaceVariant") }}>{label}</Text>
    </View>
  );
}

type ColorRole = { [K in keyof typeof tokens]: K extends `colorLight${infer R}` ? R : never }[keyof typeof tokens];

/** Light or dark token for a Material color role, following the system color scheme. */
function useRole(): (role: ColorRole) => string {
  const dark = useColorScheme() === "dark";
  return (role) => (dark ? tokens[`colorDark${role}`] : tokens[`colorLight${role}`]);
}
