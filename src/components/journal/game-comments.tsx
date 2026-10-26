import { InlineField } from "./inline/inline-field";
import type { JournalView } from "@/lib/journal/journal-location";
import type { JournalEntry } from "@/lib/journal/journal-types";

export function GameComments({
  entry,
  inlineView,
}: {
  entry: JournalEntry;
  inlineView?: JournalView;
}) {
  return (
    <span
      className="game-comments"
      role="note"
      aria-label={"Comentarios adicionales de " + entry.title}
    >
      <span className="game-comments-label">Comentarios adicionales</span>
      {inlineView ? (
        <InlineField entry={entry} view={inlineView} field="notes">
          <span className="game-comments-text">{entry.notes}</span>
        </InlineField>
      ) : (
        <span className="game-comments-text">{entry.notes}</span>
      )}
    </span>
  );
}
