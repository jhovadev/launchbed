import { useRouter } from "expo-router";
import { LoginScreen } from "../launchbed/screens/LoginScreen";

export default function LoginRoute() {
  const router = useRouter();
  return <LoginScreen onLoggedIn={() => router.replace("/")} onRegister={() => router.push("/register")} />;
}
