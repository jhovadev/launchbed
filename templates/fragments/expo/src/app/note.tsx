import { useLocalSearchParams, useRouter } from "expo-router";
import { NoteEditorScreen } from "../launchbed/screens/NoteEditorScreen";

export default function NoteRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <NoteEditorScreen id={typeof id === "string" && id ? id : undefined} onDone={() => router.back()} />;
}
