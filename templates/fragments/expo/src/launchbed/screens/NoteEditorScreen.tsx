import { useEffect, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { Button } from "../../../components/ui/Button";
import { TextField } from "../../../components/ui/TextField";
import { validateNote } from "../notes/notes-repository";
import { notesRepository } from "../notes/notes-store";
import { useAppColors } from "../theme";
import { Screen } from "./Screen";

/** Create or edit a note. Without an id it creates a new one. */
export function NoteEditorScreen({ id, onDone }: { id?: string; onDone: () => void }) {
  const colors = useAppColors();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!id);

  useEffect(() => {
    if (!id) return;
    notesRepository.get(id).then((note) => {
      if (note) {
        setTitle(note.title);
        setBody(note.body);
      }
      setLoaded(true);
    });
  }, [id]);

  async function save() {
    const problem = validateNote({ title, body });
    setError(problem);
    if (problem) return;
    await notesRepository.save({ id, title, body });
    onDone();
  }

  async function remove() {
    if (id) await notesRepository.remove(id);
    onDone();
  }

  return (
    <Screen title={id ? "Edit note" : "New note"} onBack={onDone}>
      {loaded ? (
        <>
          <TextField label="Title" value={title} onChange={setTitle} />
          <View>
            <Text style={{ color: colors.onSurfaceVariant }}>Note</Text>
            <TextInput
              accessibilityLabel="Note"
              value={body}
              onChangeText={setBody}
              multiline
              textAlignVertical="top"
              style={{
                minHeight: 160,
                marginTop: 4,
                padding: 12,
                borderWidth: 1,
                borderRadius: 8,
                borderColor: colors.outline,
                color: colors.onSurface,
              }}
            />
          </View>
          {error ? <Text style={{ color: colors.error }}>{error}</Text> : null}
          <Button label="Save" size="lg" onPress={save} />
          {id ? <Button label="Delete" variant="outlined" size="lg" onPress={remove} /> : null}
        </>
      ) : null}
    </Screen>
  );
}
