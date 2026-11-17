import { Switch, Text, View, useColorScheme } from "react-native";
import { tokens } from "../../tokens/tokens";

export interface SwitchRowProps {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

export function SwitchRow({ label, checked, onChange, disabled = false }: SwitchRowProps) {
  const role = useRole();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Text style={{ color: role("OnSurface") }}>{label}</Text>
      <Switch
        accessibilityLabel={label}
        accessibilityRole="switch"
        value={checked}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: role("Primary") }}
      />
    </View>
  );
}

type ColorRole = { [K in keyof typeof tokens]: K extends `colorLight${infer R}` ? R : never }[keyof typeof tokens];

/** Light or dark token for a Material color role, following the system color scheme. */
function useRole(): (role: ColorRole) => string {
  const dark = useColorScheme() === "dark";
  return (role) => (dark ? tokens[`colorDark${role}`] : tokens[`colorLight${role}`]);
}
