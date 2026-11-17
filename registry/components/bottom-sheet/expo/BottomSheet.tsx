import type { ReactNode } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { tokens } from "../../tokens/tokens";

export interface BottomSheetProps {
  visible: boolean;
  title: string;
  onDismiss: () => void;
  children: ReactNode;
}

/** Modal bottom sheet. Android back and a tap on the scrim call onDismiss. */
export function BottomSheet({ visible, title, onDismiss, children }: BottomSheetProps) {
  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onDismiss}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close sheet"
          onPress={onDismiss}
          style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: tokens.colorLightScrim, opacity: 0.32 }}
        />
        <View
          accessibilityViewIsModal
          style={{
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingHorizontal: 24,
            paddingBottom: 32,
            gap: 12,
            backgroundColor: tokens.colorLightSurface,
          }}
        >
          <View
            style={{ alignSelf: "center", width: 32, height: 4, borderRadius: 2, marginTop: 16, marginBottom: 8, backgroundColor: tokens.colorLightOnSurfaceVariant, opacity: 0.4 }}
          />
          <Text accessibilityRole="header" style={{ fontSize: 22, color: tokens.colorLightOnSurface }}>{title}</Text>
          {children}
        </View>
      </View>
    </Modal>
  );
}
