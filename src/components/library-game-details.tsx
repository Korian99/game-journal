import { formatDate } from "@/lib/view-config";
import type { JournalRecord } from "@/lib/types";

export function ReviewMark({ rating }: Pick<JournalRecord, "rating">) {
  return (
    <span
      className="review-mark"
      aria-label={rating == null ? "Sin reseña" : "Reseña: " + rating + "/100"}
    >
      <b>{rating ?? "—"}</b>
      <small>/100</small>
    </span>
  );
}

export function LibraryPlaythrough({ record }: { record: JournalRecord }) {
  return (
    <span className="library-playthrough">
      <span>
        <span>Empecé:</span> <span>{formatDate(record.started) || "—"}</span>
      </span>
      <span className="mobile-game-hours">
        <span>Hs. jugadas:</span>{" "}
        <span>{record.hours == null ? "—" : record.hours + " h"}</span>
      </span>
      <span>
        <span>Hs. estimadas:</span> <span>{record.estimated || "—"}</span>
      </span>
    </span>
  );
}

export function LibraryFinishReason({
  record,
  showLabel = false,
}: {
  record: JournalRecord;
  showLabel?: boolean;
}) {
  return (
    <span className="library-finish-reason">
      <span className="library-finished">
        <span>Terminé:</span> <span>{formatDate(record.finished) || "—"}</span>
      </span>
      {showLabel && <b>Por qué</b>}
      <span className="entry-text-cell">{record.reason || "—"}</span>
    </span>
  );
}
