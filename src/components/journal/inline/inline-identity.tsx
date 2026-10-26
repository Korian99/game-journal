"use client";
import { useContext } from "react";
import { Pencil } from "lucide-react";
import type { JournalEntry } from "@/lib/journal/journal-types";
import type { JournalView } from "@/lib/journal/journal-location";
import type { Offer } from "@/lib/types";
import { journalReviewOrder } from "@/lib/journal/view-config";
import { statuses } from "@/lib/types";
import { wishlistPlatforms } from "@/lib/offers/wishlist-display";
import { InlineField } from "./inline-field";
import { InlineEditContext } from "./inline-context";
import { ReviewMark } from "../library-game-details";
import { JournalScoreMark } from "../journal-review";
export function InlineIdentity({
  entry,
  view,
  offers,
  onEdit,
}: {
  entry: JournalEntry;
  view: JournalView;
  offers: Offer[];
  onEdit: (entry: JournalEntry) => void;
}) {
  const edit = useContext(InlineEditContext);
  const played = view === "library" || view === "journal";
  return (
    <div
      className={
        "game-cell inline-game-cell " +
        (view === "library"
          ? "library-game-cell"
          : view === "journal"
            ? "journal-game-cell"
            : view === "upcoming"
              ? "upcoming-name"
              : "wishlist-name")
      }
      tabIndex={-1}
    >
      {view === "library" && (
        <InlineField entry={entry} view={view} field="rating" slot="badge">
          <ReviewMark rating={entry.rating} />
        </InlineField>
      )}
      {view === "journal" && (
        <InlineField
          entry={entry}
          view={view}
          field={
            entry.rating == null && journalReviewOrder(entry) !== undefined
              ? "impression"
              : "rating"
          }
          slot="badge"
        >
          <JournalScoreMark record={entry} />
        </InlineField>
      )}
      <span className="library-game-identity">
        <InlineField entry={entry} view={view} field="title">
          <strong>{entry.title}</strong>
        </InlineField>
        {played ? (
          <>
            <small>
              <InlineField entry={entry} view={view} field="device">
                {entry.device || entry.platforms || "Sin consola"}
              </InlineField>
            </small>
            <InlineField entry={entry} view={view} field="status">
              <span className={"status " + entry.status}>
                {statuses[entry.status]}
              </span>
            </InlineField>
          </>
        ) : (
          <small title="Plataformas según las páginas añadidas">
            {wishlistPlatforms(
              entry,
              offers.filter((offer) => offer.game_id === entry.gameId),
            ).join(" · ") || "Plataforma sin confirmar"}
          </small>
        )}
      </span>
      <button
        type="button"
        className="inline-details icon-button"
        aria-label={"Ver detalles de " + entry.title}
        title="Editar todos los datos"
        disabled={edit?.dirty || edit?.saving}
        onClick={() => {
          edit?.cancel();
          onEdit(entry);
        }}
      >
        <Pencil size={15} aria-hidden="true" />
      </button>
    </div>
  );
}
