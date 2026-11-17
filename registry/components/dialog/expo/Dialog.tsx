import { Modal, Pressable, Text, View } from "react-native";
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
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onDismiss}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "rgba(0,0,0,0.4)" }}>
        <View
          accessibilityViewIsModal
          accessibilityRole="alert"
          style={{ width: "100%", maxWidth: 360, borderRadius: 28, padding: 24, gap: 16, backgroundColor: tokens.colorLightSurface }}
        >
          <Text accessibilityRole="header" style={{ fontSize: 22, color: tokens.colorLightOnSurface }}>{title}</Text>
          <Text style={{ fontSize: 14, color: tokens.colorLightOnSurfaceVariant }}>{message}</Text>
          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8 }}>
            <Pressable accessibilityRole="button" onPress={onDismiss} style={{ paddingHorizontal: 12, paddingVertical: 10 }}>
              <Text style={{ color: tokens.colorLightPrimary, fontWeight: "600" }}>{dismissLabel}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={onConfirm} style={{ paddingHorizontal: 12, paddingVertical: 10 }}>
              <Text style={{ color: tokens.colorLightPrimary, fontWeight: "600" }}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
