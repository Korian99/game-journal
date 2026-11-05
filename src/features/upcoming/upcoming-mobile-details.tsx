import type { JournalEntry } from "@/lib/journal/journal-types";
import type { Offer } from "@/lib/types";
import { releaseHasArrived, releaseLabel } from "@/lib/releases";
import { wishlistPlatforms } from "@/features/wishlist/wishlist-display";
import { HypeBadge } from "@/features/entries/hype-badge";

export function UpcomingMobileDetails({
  entry,
  offers,
  releaseNow,
}: {
  entry: JournalEntry;
  offers: Offer[];
  releaseNow: Date;
}) {
  const gameOffers = offers.filter((offer) => offer.game_id === entry.gameId);
  return (
    <>
      <small>
        {wishlistPlatforms(entry, gameOffers).join(" · ") ||
          "Plataforma sin confirmar"}
      </small>
      <small>
        Fecha de salida: {releaseLabel(entry)}
        {releaseHasArrived(entry, releaseNow) && (
          <span className="released-badge">Ya salió</span>
        )}
      </small>
      <small className="upcoming-mobile-hype">
        Hype <HypeBadge value={entry.hype} />
      </small>
    </>
  );
}
