import type { JournalEntry } from "@/lib/journal/journal-types";
import type { Offer } from "@/lib/types";
import { releaseHasArrived, releaseLabel } from "@/lib/releases";
import { wishlistPlatforms } from "@/features/wishlist/wishlist-display";
import { HypeBadge } from "@/features/entries/hype-badge";
import { LoaderCircle } from "lucide-react";

export function UpcomingMobileDetails({
  entry,
  offers,
  releaseNow,
  refreshing,
}: {
  entry: JournalEntry;
  offers: Offer[];
  releaseNow: Date;
  refreshing: boolean;
}) {
  const gameOffers = offers.filter((offer) => offer.game_id === entry.gameId);
  return (
    <>
      <small>
        {wishlistPlatforms(entry, gameOffers).join(" · ") ||
          "Plataforma sin confirmar"}
      </small>
      <small
        className="upcoming-release-date"
        aria-busy={refreshing}
        role={refreshing ? "status" : undefined}
        aria-label={refreshing ? "Actualizando fechas de lanzamiento" : undefined}
      >
        {refreshing ? (
          <LoaderCircle
            size={14}
            className="save-spinner"
            aria-hidden="true"
          />
        ) : (
          <>
            Fecha de salida: {releaseLabel(entry)}
            {releaseHasArrived(entry, releaseNow) && (
              <span className="released-badge">Ya salió</span>
            )}
          </>
        )}
      </small>
      <small className="upcoming-mobile-hype">
        Hype <HypeBadge value={entry.hype} />
      </small>
    </>
  );
}
