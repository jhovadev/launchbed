import { useState } from "react";
import { Text } from "react-native";
import { Button } from "../../../components/ui/Button";
import { TextField } from "../../../components/ui/TextField";
import { confirmPasswordError, emailError, passwordError } from "../auth/validation";
import { useSession } from "../session";
import { useAppColors } from "../theme";
import { Screen } from "./Screen";

export function RegisterScreen({ onRegistered, onSignIn }: { onRegistered: () => void; onSignIn: () => void }) {
  const session = useSession();
  const colors = useAppColors();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const show = (message: string | null) => (submitted ? message : null);

  function submit() {
    setSubmitted(true);
    if (emailError(email) || passwordError(password) || confirmPasswordError(password, confirm)) return;
    const result = session.register(email, password, displayName);
    if (result.ok) onRegistered();
    else setFailure(result.message);
  }

  return (
    <Screen title="Create account" onBack={onSignIn}>
      <Text style={{ color: colors.onSurfaceVariant }}>Accounts exist only in memory for this session. This is not a real backend.</Text>
      <TextField label="Display name" value={displayName} onChange={setDisplayName} />
      <TextField label="Email" value={email} onChange={setEmail} error={show(emailError(email))} />
      <TextField label="Password" value={password} onChange={setPassword} error={show(passwordError(password))} secure />
      <TextField label="Confirm password" value={confirm} onChange={setConfirm} error={show(confirmPasswordError(password, confirm))} secure />
      {failure ? <Text accessibilityRole="alert" style={{ color: colors.error }}>{failure}</Text> : null}
      <Button label="Create account" size="lg" onPress={submit} />
      <Button label="Already have an account" variant="text" onPress={onSignIn} />
    </Screen>
  );
}
