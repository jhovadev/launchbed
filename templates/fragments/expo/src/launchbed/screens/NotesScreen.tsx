import { Pressable, Text, View } from "react-native";
import { Card } from "../../../components/ui/Card";
import { ListItem } from "../../../components/ui/ListItem";
import { useNotes } from "../notes/notes-store";
import { useAppColors } from "../theme";
import { Screen } from "./Screen";

function preview(body: string): string {
  const line = body.split("\n").find((part) => part.trim()) ?? "";
  return line.length > 80 ? `${line.slice(0, 79)}…` : line;
}

/** Notes list, saved on the device. Mirrors the Compose NotesScreen (Room) with AsyncStorage. */
export function NotesScreen({ onOpen, onCreate }: { onOpen: (id: string) => void; onCreate: () => void }) {
  const colors = useAppColors();
  const { notes, loading } = useNotes();
  return (
    <View style={{ flex: 1 }}>
      <Screen title="Notes">
        {loading ? null : notes.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 48, gap: 8 }}>
            <Text style={{ fontSize: 18, fontWeight: "600", color: colors.onSurface }}>No notes yet</Text>
            <Text style={{ color: colors.onSurfaceVariant, textAlign: "center" }}>Tap + to write your first note. Notes stay on this device.</Text>
          </View>
        ) : (
          <Card style={{ padding: 0 }}>
            {notes.map((note) => (
              <ListItem key={note.id} title={note.title || "Untitled"} subtitle={preview(note.body) || undefined} onPress={() => onOpen(note.id)} />
            ))}
          </Card>
        )}
      </Screen>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="New note"
        onPress={onCreate}
        style={({ pressed }) => ({
          position: "absolute",
          right: 16,
          bottom: 16,
          width: 56,
          height: 56,
          borderRadius: 16,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.primaryContainer,
          opacity: pressed ? 0.85 : 1,
          elevation: 3,
          shadowColor: "#000",
          shadowOpacity: 0.2,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
        })}
      >
        <Text style={{ fontSize: 28, lineHeight: 30, color: colors.onPrimaryContainer }}>+</Text>
      </Pressable>
    </View>
  );
}
