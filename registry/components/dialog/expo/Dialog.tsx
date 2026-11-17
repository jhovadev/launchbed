import { Modal, Pressable, Text, View, useColorScheme } from "react-native";
import { tokens } from "../../tokens/tokens";

export interface DialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onDismiss: () => void;
  dismissLabel?: string;
}

export function Dialog({ visible, title, message, confirmLabel, onConfirm, onDismiss, dismissLabel = "Cancel" }: DialogProps) {
  const role = useRole();
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onDismiss}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: `${role("Scrim")}66` }}>
        <View
          accessibilityViewIsModal
          accessibilityRole="alert"
          style={{ width: "100%", maxWidth: 360, borderRadius: 28, padding: 24, gap: 16, backgroundColor: role("Surface") }}
        >
          <Text accessibilityRole="header" style={{ fontSize: 22, color: role("OnSurface") }}>{title}</Text>
          <Text style={{ fontSize: 14, color: role("OnSurfaceVariant") }}>{message}</Text>
          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8 }}>
            <Pressable accessibilityRole="button" onPress={onDismiss} style={{ paddingHorizontal: 12, paddingVertical: 10 }}>
              <Text style={{ color: role("Primary"), fontWeight: "600" }}>{dismissLabel}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={onConfirm} style={{ paddingHorizontal: 12, paddingVertical: 10 }}>
              <Text style={{ color: role("Primary"), fontWeight: "600" }}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

type ColorRole = { [K in keyof typeof tokens]: K extends `colorLight${infer R}` ? R : never }[keyof typeof tokens];

/** Light or dark token for a Material color role, following the system color scheme. */
function useRole(): (role: ColorRole) => string {
  const dark = useColorScheme() === "dark";
  return (role) => (dark ? tokens[`colorDark${role}`] : tokens[`colorLight${role}`]);
}
