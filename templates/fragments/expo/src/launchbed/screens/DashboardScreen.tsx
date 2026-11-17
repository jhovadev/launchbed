import { Text, View } from "react-native";
import { Badge } from "../../../components/ui/Badge";
import { Card } from "../../../components/ui/Card";
import { ListItem } from "../../../components/ui/ListItem";
import { useAppColors } from "../theme";
import { Screen } from "./Screen";

// Placeholder values, identical to the Compose DashboardScreen. Replace with your own data.
export const SAMPLE_STATS = [
  { label: "Tasks done", value: "8/12" },
  { label: "Due today", value: "3" },
  { label: "Messages", value: "5" },
  { label: "Streak", value: "4 days" },
] as const;

export const SAMPLE_ACTIVITY = [
  { title: "Design review", detail: "Moved to Done", time: "2h" },
  { title: "Weekly sync", detail: "Notes added", time: "5h" },
  { title: "Release 1.0", detail: "Build ready to test", time: "1d" },
] as const;

export function DashboardScreen() {
  const colors = useAppColors();
  return (
    <Screen title="Dashboard">
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View>
          <Text accessibilityRole="header" style={{ fontSize: 24, fontWeight: "600", color: colors.primary }}>Overview</Text>
          <Text style={{ color: colors.onSurfaceVariant }}>Good to see you</Text>
        </View>
        <Badge label="Sample data" />
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {SAMPLE_STATS.map((stat) => (
          <View
            key={stat.label}
            accessible
            accessibilityLabel={`${stat.label}: ${stat.value}`}
            style={{ flexGrow: 1, flexBasis: "45%", borderRadius: 16, padding: 16, backgroundColor: colors.surfaceVariant }}
          >
            <Text style={{ fontSize: 22, fontWeight: "600", color: colors.onSurface }}>{stat.value}</Text>
            <Text style={{ color: colors.onSurfaceVariant }}>{stat.label}</Text>
          </View>
        ))}
      </View>
      <Text accessibilityRole="header" style={{ fontSize: 16, fontWeight: "600", color: colors.onSurface }}>Recent activity</Text>
      <Card style={{ padding: 0, borderWidth: 1, borderColor: colors.outlineVariant }}>
        {SAMPLE_ACTIVITY.map((item) => (
          <ListItem key={item.title} title={item.title} subtitle={`${item.detail} · ${item.time}`} />
        ))}
      </Card>
    </Screen>
  );
}
