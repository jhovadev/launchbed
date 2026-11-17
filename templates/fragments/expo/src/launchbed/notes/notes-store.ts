import { useEffect, useState } from "react";
import { appStore } from "../storage/app-store";
import { createNotesRepository, type Note } from "./notes-repository";

/** The app-wide notes repository, saved on the device. */
export const notesRepository = createNotesRepository(appStore);

/** Live list of notes, newest first. */
export function useNotes(): { notes: Note[]; loading: boolean } {
  const [state, setState] = useState<{ notes: Note[]; loading: boolean }>({ notes: [], loading: true });
  useEffect(() => {
    let active = true;
    const refresh = () => {
      notesRepository.list().then((notes) => {
        if (active) setState({ notes, loading: false });
      });
    };
    refresh();
    const unsubscribe = notesRepository.subscribe(refresh);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  return state;
}
