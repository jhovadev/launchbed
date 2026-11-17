import { Switch, Text, View } from "react-native";
import { tokens } from "../../tokens/tokens";

export interface SwitchRowProps {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

export function SwitchRow({ label, checked, onChange, disabled = false }: SwitchRowProps) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Text>{label}</Text>
      <Switch
        accessibilityLabel={label}
        accessibilityRole="switch"
        value={checked}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: tokens.colorLightPrimary }}
      />
    </View>
  );
}
