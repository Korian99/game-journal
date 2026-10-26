import { InlineField } from "./inline/inline-field";
import type { JournalEntry } from "@/lib/journal/journal-types";
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
export function JournalReview({
  record,
  inline = false,
}: {
  record: JournalEntry;
  inline?: boolean;
}) {
  return (
    <span className="journal-review-summary">
      <span>
        <b>Reseña:</b>{" "}
        {inline ? (
          <InlineField entry={record} view="journal" field="rating">
            {record.rating == null ? "—" : record.rating + "/100"}
          </InlineField>
        ) : (
          <span>{record.rating == null ? "—" : record.rating + "/100"}</span>
        )}
      </span>
      <span>
        <b>Memorabilidad:</b>{" "}
        {inline ? (
          <InlineField entry={record} view="journal" field="memorability">
            {record.memorability == null ? "—" : record.memorability + "/10"}
          </InlineField>
        ) : (
          <span>
            {record.memorability == null ? "—" : record.memorability + "/10"}
          </span>
        )}
      </span>
      <span>
        <b>Impresiones:</b>{" "}
        {inline ? (
          <InlineField entry={record} view="journal" field="impression">
            {record.impression || "—"}
          </InlineField>
        ) : (
          <span>{record.impression || "—"}</span>
        )}
      </span>
    </span>
  );
}
