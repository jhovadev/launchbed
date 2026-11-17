import { useState } from "react";
import { Text, View } from "react-native";
import { Button } from "../../../components/ui/Button";
import { useAppColors } from "../theme";

export const ONBOARDING_PAGES = [
  { title: "Welcome", body: "A short tour of this generated app." },
  { title: "Your data stays here", body: "This starter keeps everything in memory on the device." },
  { title: "You are ready", body: "Continue to start using the app." },
] as const;

export function OnboardingScreen({ onFinished }: { onFinished: () => void }) {
  const colors = useAppColors();
  const [index, setIndex] = useState(0);
  const page = ONBOARDING_PAGES[index] ?? ONBOARDING_PAGES[0];
  const last = index === ONBOARDING_PAGES.length - 1;
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 24, justifyContent: "space-between" }}>
      <View style={{ flex: 1, justifyContent: "center", gap: 12 }} accessibilityLabel="Onboarding pages">
        <Text accessibilityRole="header" style={{ fontSize: 30, fontWeight: "600", color: colors.onSurface }}>{page.title}</Text>
        <Text style={{ fontSize: 16, color: colors.onSurfaceVariant }}>{page.body}</Text>
        <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }} accessibilityLabel={`Page ${index + 1} of ${ONBOARDING_PAGES.length}`}>
          {ONBOARDING_PAGES.map((item, dot) => (
            <View
              key={item.title}
              style={{ height: 8, width: dot === index ? 24 : 8, borderRadius: 4, backgroundColor: dot === index ? colors.primary : colors.outlineVariant }}
            />
          ))}
        </View>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Button label="Skip" variant="text" onPress={onFinished} />
        <Button label={last ? "Get started" : "Next"} onPress={() => (last ? onFinished() : setIndex(index + 1))} />
      </View>
    </View>
  );
}
