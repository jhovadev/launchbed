import { useState } from "react";
import { Text } from "react-native";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { TextField } from "../../../components/ui/TextField";
import { DEMO_EMAIL, DEMO_PASSWORD } from "../auth/fake-auth";
import { emailError, passwordError } from "../auth/validation";
import { useSession } from "../session";
import { useAppColors } from "../theme";
import { Screen } from "./Screen";

export function LoginScreen({ onLoggedIn, onRegister }: { onLoggedIn: () => void; onRegister: () => void }) {
  const session = useSession();
  const colors = useAppColors();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const errors = { email: submitted ? emailError(email) : null, password: submitted ? passwordError(password) : null };

  function submit() {
    setSubmitted(true);
    if (emailError(email) || passwordError(password)) return;
    const result = session.signIn(email, password);
    if (result.ok) onLoggedIn();
    else setFailure(result.message);
  }

  return (
    <Screen title="Sign in">
      <Card style={{ backgroundColor: colors.secondaryContainer }}>
        <Text style={{ color: colors.onSecondaryContainer }}>Demo only. This screen talks to an in-memory fake, not a real backend.</Text>
        <Text style={{ color: colors.onSecondaryContainer, marginTop: 4 }}>Try {DEMO_EMAIL} / {DEMO_PASSWORD}</Text>
      </Card>
      <TextField label="Email" value={email} onChange={setEmail} error={errors.email} />
      <TextField label="Password" value={password} onChange={setPassword} error={errors.password} secure />
      {failure ? <Text accessibilityRole="alert" style={{ color: colors.error }}>{failure}</Text> : null}
      <Button label="Sign in" size="lg" onPress={submit} />
      <Button label="Create an account" variant="text" onPress={onRegister} />
    </Screen>
  );
}
