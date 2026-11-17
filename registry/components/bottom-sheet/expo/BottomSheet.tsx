import type { ReactNode } from "react";
import { Modal, Pressable, Text, View, useColorScheme } from "react-native";
import { tokens } from "../../tokens/tokens";

export interface BottomSheetProps {
  visible: boolean;
  title: string;
  onDismiss: () => void;
  children: ReactNode;
}

/** Modal bottom sheet. Android back and a tap on the scrim call onDismiss. */
export function BottomSheet({ visible, title, onDismiss, children }: BottomSheetProps) {
  const role = useRole();
  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onDismiss}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close sheet"
          onPress={onDismiss}
          style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: role("Scrim"), opacity: 0.32 }}
        />
        <View
          accessibilityViewIsModal
          style={{
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingHorizontal: 24,
            paddingBottom: 32,
            gap: 12,
            backgroundColor: role("Surface"),
          }}
        >
          <View
            style={{ alignSelf: "center", width: 32, height: 4, borderRadius: 2, marginTop: 16, marginBottom: 8, backgroundColor: role("OnSurfaceVariant"), opacity: 0.4 }}
          />
          <Text accessibilityRole="header" style={{ fontSize: 22, color: role("OnSurface") }}>{title}</Text>
          {children}
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
