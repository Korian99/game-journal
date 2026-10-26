import { formatDate } from "@/lib/journal/view-config";
import type { JournalRecord } from "@/lib/types";
import type { JournalEntry } from "@/lib/journal/journal-types";
import { InlineField } from "./inline/inline-field";
export function ReviewMark({
  rating,
  label = "Reseña",
  emptyLabel = "Sin reseña",
}: Pick<JournalRecord, "rating"> & { label?: string; emptyLabel?: string }) {
  return (
    <span
      className="review-mark"
      aria-label={rating == null ? emptyLabel : label + ": " + rating + "/100"}
    >
      <b>{rating ?? "—"}</b>
      <small>/100</small>
    </span>
  );
}
export function LibraryPlaythrough({
  record,
  inline = false,
}: {
  record: JournalEntry;
  inline?: boolean;
}) {
  return (
    <span className="library-playthrough">
      <span>
        <span>Empecé:</span>{" "}
        {inline ? (
          <InlineField entry={record} view="library" field="started">
            {formatDate(record.started) || "—"}
          </InlineField>
        ) : (
          <span>{formatDate(record.started) || "—"}</span>
        )}
      </span>
      <span className="mobile-game-hours">
        <span>Hs. jugadas:</span>{" "}
        {inline ? (
          <InlineField entry={record} view="library" field="hours">
            {record.hours == null ? "—" : record.hours + " h"}
          </InlineField>
        ) : (
          <span>{record.hours == null ? "—" : record.hours + " h"}</span>
        )}
      </span>
      <span>
        <span>Hs. estimadas:</span>{" "}
        {inline ? (
          <InlineField entry={record} view="library" field="estimated">
            {record.estimated || "—"}
          </InlineField>
        ) : (
          <span>{record.estimated || "—"}</span>
        )}
      </span>
    </span>
  );
}
export function LibraryFinishReason({
  record,
  showLabel = false,
  inline = false,
}: {
  record: JournalEntry;
  showLabel?: boolean;
  inline?: boolean;
}) {
  return (
    <span className="library-finish-reason">
      <span className="library-finished">
        <span>Terminé:</span>{" "}
        {inline ? (
          <InlineField entry={record} view="library" field="finished">
            {formatDate(record.finished) || "—"}
          </InlineField>
        ) : (
          <span>{formatDate(record.finished) || "—"}</span>
        )}
      </span>
      {showLabel && <b>Por qué</b>}
      {inline ? (
        <InlineField entry={record} view="library" field="reason">
          <span className="entry-text-cell">{record.reason || "—"}</span>
        </InlineField>
      ) : (
        <span className="entry-text-cell">{record.reason || "—"}</span>
      )}
    </span>
  );
}
