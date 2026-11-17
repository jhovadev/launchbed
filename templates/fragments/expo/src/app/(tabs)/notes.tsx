import { useRouter } from "expo-router";
import { NotesScreen } from "../../launchbed/screens/NotesScreen";

export default function NotesTab() {
  const router = useRouter();
  return <NotesScreen onOpen={(id) => router.push({ pathname: "/note", params: { id } })} onCreate={() => router.push("/note")} />;
}
