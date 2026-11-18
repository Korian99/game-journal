import type { JournalEntry } from "@/lib/journal/journal-types";

export const notebookReminderMessages = {
  saved: (title: string) => `Nota agregada al recordatorio de ${title}.`,
  saveError: "No se pudo agregar la nota al juego. Volvé a intentarlo.",
};

export function NotebookGameReminderPicker({
  games,
  selectedId,
  disabled,
  canAppend,
  appending,
  onSelect,
  onAppend,
}: {
  games: Pick<JournalEntry, "id" | "title" | "device" | "period">[];
  selectedId: string;
  disabled: boolean;
  canAppend: boolean;
  appending: boolean;
  onSelect: (id: string) => void;
  onAppend: () => void;
}) {
  return (
    <div className="notebook-game-note">
      <label className="notebook-notes-label" htmlFor="notebook-game">
        Juego en curso
      </label>
      <p className="notebook-message" id="notebook-game-description">
        {games.length
          ? "Agregá todo este texto al recordatorio privado del juego."
          : "Acá aparecen los juegos marcados como Jugando."}
      </p>
      <div className="notebook-game-controls">
        <select
          id="notebook-game"
          aria-describedby="notebook-game-description"
          disabled={disabled || !games.length}
          value={selectedId}
          onChange={(event) => onSelect(event.target.value)}
        >
          <option value="">Elegí un juego</option>
          {games.map((record) => (
            <option key={record.id} value={record.id}>
              {[record.title, record.device, record.period]
                .filter(Boolean)
                .join(" · ")}
            </option>
          ))}
        </select>
        <button
          className="secondary"
          disabled={disabled || !canAppend}
          onClick={onAppend}
        >
          {appending ? "Agregando…" : "Agregar al recordatorio"}
        </button>
      </div>
    </div>
  );
}
