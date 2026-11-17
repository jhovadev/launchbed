import { useRouter } from "expo-router";
import { ProfileEditScreen } from "../launchbed/screens/ProfileEditScreen";

export default function ProfileEditRoute() {
  const router = useRouter();
  return <ProfileEditScreen onSaved={() => router.back()} />;
}
