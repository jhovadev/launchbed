import { useRouter } from "expo-router";
import { ProfileScreen } from "../../launchbed/screens/ProfileScreen";

export default function ProfileTab() {
  const router = useRouter();
  return <ProfileScreen onEdit={() => router.push("/profile-edit")} onSignedOut={() => router.replace("/")} />;
}
