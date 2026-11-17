import { useRouter } from "expo-router";
import { OnboardingScreen } from "../launchbed/screens/OnboardingScreen";
import { useSession } from "../launchbed/session";

export default function OnboardingRoute() {
  const router = useRouter();
  const session = useSession();
  return (
    <OnboardingScreen
      onFinished={() => {
        session.completeOnboarding();
        router.replace("/");
      }}
    />
  );
}
