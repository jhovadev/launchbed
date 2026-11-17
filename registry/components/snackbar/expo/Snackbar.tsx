import { Pressable, Text, View, useColorScheme } from "react-native";
import { tokens } from "../../tokens/tokens";

export interface SnackbarProps {
  message: string;
  visible: boolean;
  actionLabel?: string;
  onAction?: () => void;
}

export function Snackbar({ message, visible, actionLabel, onAction }: SnackbarProps) {
  const role = useRole();
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
        backgroundColor: role("InverseSurface"),
      }}
    >
      <Text style={{ flex: 1, color: role("InverseOnSurface") }}>{message}</Text>
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" accessibilityLabel={actionLabel} onPress={onAction} hitSlop={8}>
          <Text style={{ color: role("InversePrimary"), fontWeight: "600" }}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

type ColorRole = { [K in keyof typeof tokens]: K extends `colorLight${infer R}` ? R : never }[keyof typeof tokens];

/** Light or dark token for a Material color role, following the system color scheme. */
function useRole(): (role: ColorRole) => string {
  const dark = useColorScheme() === "dark";
  return (role) => (dark ? tokens[`colorDark${role}`] : tokens[`colorLight${role}`]);
}
