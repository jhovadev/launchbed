import { Redirect } from "expo-router";

// The official "Explore" tab is replaced by the Launchbed tabs in src/app/(tabs).
export default function Explore() {
  return <Redirect href="/" />;
}
