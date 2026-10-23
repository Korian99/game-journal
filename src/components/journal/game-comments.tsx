import type { JournalEntry } from "@/lib/journal/journal-types";

export function GameComments({ entry }: { entry: JournalEntry }) {
  return (
    <span
      className="game-comments"
      role="note"
      aria-label={"Comentarios adicionales de " + entry.title}
    >
      <span className="game-comments-label">Comentarios adicionales</span>
      <span className="game-comments-text">{entry.notes}</span>
    </span>
  );
}
