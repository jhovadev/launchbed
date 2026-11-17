import { Pressable, Text, View } from "react-native";
import { tokens } from "../../tokens/tokens";

export interface SnackbarProps {
  message: string;
  visible: boolean;
  actionLabel?: string;
  onAction?: () => void;
}

export function Snackbar({ message, visible, actionLabel, onAction }: SnackbarProps) {
  if (!visible) return null;
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        minHeight: 48,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 6,
        backgroundColor: tokens.colorLightInverseSurface,
      }}
    >
      <Text style={{ flex: 1, color: tokens.colorLightInverseOnSurface }}>{message}</Text>
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" accessibilityLabel={actionLabel} onPress={onAction} hitSlop={8}>
          <Text style={{ color: tokens.colorLightInversePrimary, fontWeight: "600" }}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
