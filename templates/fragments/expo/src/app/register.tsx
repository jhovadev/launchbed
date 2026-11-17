import { useRouter } from "expo-router";
import { RegisterScreen } from "../launchbed/screens/RegisterScreen";

export default function RegisterRoute() {
  const router = useRouter();
  return <RegisterScreen onRegistered={() => router.replace("/")} onSignIn={() => router.back()} />;
}
