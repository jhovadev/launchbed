import { Text, TextInput, View, useColorScheme } from "react-native";
import { tokens } from "../../tokens/tokens";

export interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  disabled?: boolean;
  /** Hides the value, for passwords. */
  secure?: boolean;
}

export function TextField({ label, value, onChange, error, disabled = false, secure = false }: TextFieldProps) {
  const role = useRole();
  return (
    <View>
      <Text accessibilityRole="text" style={{ color: role("OnSurfaceVariant") }}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={error ?? undefined}
        value={value}
        onChangeText={onChange}
        editable={!disabled}
        secureTextEntry={secure}
        autoCapitalize={secure ? "none" : undefined}
        style={{
          borderWidth: 1,
          borderColor: error ? role("Error") : role("Outline"),
          borderRadius: 8,
          padding: 12,
          marginTop: 4,
          color: role("OnSurface"),
        }}
      />
      {error ? <Text style={{ color: role("Error") }}>{error}</Text> : null}
    </View>
  );
}

type ColorRole = { [K in keyof typeof tokens]: K extends `colorLight${infer R}` ? R : never }[keyof typeof tokens];

/** Light or dark token for a Material color role, following the system color scheme. */
function useRole(): (role: ColorRole) => string {
  const dark = useColorScheme() === "dark";
  return (role) => (dark ? tokens[`colorDark${role}`] : tokens[`colorLight${role}`]);
}
