import { Text, TextInput, View } from "react-native";
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
  return (
    <View>
      <Text accessibilityRole="text">{label}</Text>
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
          borderColor: error ? tokens.colorLightError : tokens.colorLightOutline,
          borderRadius: 8,
          padding: 12,
          marginTop: 4,
        }}
      />
      {error ? <Text style={{ color: tokens.colorLightError }}>{error}</Text> : null}
    </View>
  );
}
