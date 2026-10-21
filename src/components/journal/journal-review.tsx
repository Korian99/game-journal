import type { JournalRecord } from "@/lib/types";
import { journalReviewOrder } from "@/lib/journal/view-config";
import { ReviewMark } from "./library-game-details";
export function JournalScoreMark({ record }: { record: JournalRecord }) {
  return (
    <ReviewMark
      rating={journalReviewOrder(record) ?? null}
      label={record.rating == null ? "Impresiones" : "Reseña"}
      emptyLabel="Sin valoración"
    />
  );
}
export function JournalReview({ record }: { record: JournalRecord }) {
  return (
    <span className="journal-review-summary">
      <span>
        <b>Reseña:</b>{" "}
        <span>{record.rating == null ? "—" : record.rating + "/100"}</span>
      </span>
      <span>
        <b>Memorabilidad:</b>{" "}
        <span>
          {record.memorability == null ? "—" : record.memorability + "/10"}
        </span>
      </span>
      <span>
        <b>Impresiones:</b> <span>{record.impression || "—"}</span>
      </span>
    </span>
  );
}
