import { Pressable, Text, type StyleProp, type ViewStyle, useColorScheme } from "react-native";
import { tokens } from "../../tokens/tokens";

export type ButtonVariant = "filled" | "outlined" | "text";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

const padding: Record<ButtonSize, { paddingHorizontal: number; paddingVertical: number }> = {
  sm: { paddingHorizontal: 8, paddingVertical: 6 },
  md: { paddingHorizontal: 16, paddingVertical: 8 },
  lg: { paddingHorizontal: 24, paddingVertical: 8 },
};

export function Button({ label, onPress, variant = "filled", size = "md", disabled = false, style }: ButtonProps) {
  const role = useRole();
  const filled = variant === "filled";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        { borderRadius: 20, alignItems: "center", opacity: disabled ? 0.5 : 1, ...padding[size] },
        filled ? { backgroundColor: role("Primary") } : { borderWidth: variant === "outlined" ? 1 : 0, borderColor: role("Primary") },
        style,
      ]}
    >
      <Text style={{ color: filled ? role("OnPrimary") : role("Primary") }}>{label}</Text>
    </Pressable>
  );
}

type ColorRole = { [K in keyof typeof tokens]: K extends `colorLight${infer R}` ? R : never }[keyof typeof tokens];

/** Light or dark token for a Material color role, following the system color scheme. */
function useRole(): (role: ColorRole) => string {
  const dark = useColorScheme() === "dark";
  return (role) => (dark ? tokens[`colorDark${role}`] : tokens[`colorLight${role}`]);
}
