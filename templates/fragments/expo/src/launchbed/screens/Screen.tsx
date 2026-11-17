import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppBar } from "../../../components/ui/AppBar";
import { useAppColors } from "../theme";

/** Shared screen chrome: safe area, AppBar and a scrollable, padded body. */
export function Screen({ title, onBack, children }: { title: string; onBack?: () => void; children: ReactNode }) {
  const colors = useAppColors();
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.surface }}>
      <AppBar title={title} onBack={onBack} />
      <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 16, gap: 16 }}>
        <View style={{ gap: 16 }}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}
