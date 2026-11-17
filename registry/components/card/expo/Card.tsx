import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { tokens } from "../../tokens/tokens";

export interface CardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Card({ children, style }: CardProps) {
  return (
    <View
      style={[
        {
          backgroundColor: tokens.colorLightSurface,
          borderRadius: 16,
          padding: 16,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
