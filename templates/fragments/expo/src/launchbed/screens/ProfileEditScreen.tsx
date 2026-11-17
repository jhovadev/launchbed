import { useState } from "react";
import { Text } from "react-native";
import { Button } from "../../../components/ui/Button";
import { TextField } from "../../../components/ui/TextField";
import { useSession } from "../session";
import { useAppColors } from "../theme";
import { Screen } from "./Screen";

export function ProfileEditScreen({ onSaved }: { onSaved: () => void }) {
  const session = useSession();
  const colors = useAppColors();
  const [displayName, setDisplayName] = useState(session.user?.displayName ?? "");
  const [failure, setFailure] = useState<string | null>(null);
  return (
    <Screen title="Edit profile" onBack={onSaved}>
      <TextField label="Display name" value={displayName} onChange={setDisplayName} />
      {failure ? <Text accessibilityRole="alert" style={{ color: colors.error }}>{failure}</Text> : null}
      <Button
        label="Save"
        size="lg"
        onPress={() => {
          const result = session.updateProfile(displayName);
          if (result.ok) onSaved();
          else setFailure(result.message);
        }}
      />
    </Screen>
  );
}
