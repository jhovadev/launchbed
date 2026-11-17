import { Pressable, Text, type StyleProp, type ViewStyle } from "react-native";
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
        filled ? { backgroundColor: tokens.colorLightPrimary } : { borderWidth: variant === "outlined" ? 1 : 0, borderColor: tokens.colorLightPrimary },
        style,
      ]}
    >
      <Text style={{ color: filled ? tokens.colorLightOnPrimary : tokens.colorLightPrimary }}>{label}</Text>
    </Pressable>
  );
}
