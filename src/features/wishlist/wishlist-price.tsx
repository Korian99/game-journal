import type { Offer } from "@/lib/types";
import { LoaderCircle } from "lucide-react";

export function WishlistPrice({
  offers,
  refreshing = false,
}: {
  offers: Offer[];
  refreshing?: boolean;
}) {
  if (refreshing)
    return (
      <span
        className="wishlist-prices"
        aria-busy="true"
        role="status"
        aria-label="Actualizando precios"
      >
        <LoaderCircle size={14} className="save-spinner" aria-hidden="true" />
      </span>
    );
  if (!offers.length)
    return (
      <span className="wishlist-prices" aria-busy="false">
        <span className="muted">Sin precio</span>
      </span>
    );
  return (
    <span className="wishlist-prices" aria-busy="false">
      {offers.map((offer) => (
        <span className="wishlist-quote" key={offer.id}>
          <span className="wishlist-price-line">
            {offer.discount > 0 && offer.price !== null && (
              <span className="discount">−{offer.discount}%</span>
            )}
            <span className="wishlist-price">
              {offer.price === null
                ? "Sin precio"
                : new Intl.NumberFormat("es-AR", {
                    style: "currency",
                    currency: offer.currency ?? "USD",
                  }).format(offer.price) +
                  " " +
                  (offer.currency ?? "")}
            </span>
          </span>
          {offers.length > 1 && (
            <small className="muted">
              {offer.store === "steam" ? "Steam" : "Nintendo"} · {offer.region}
            </small>
          )}
          {offer.error && (
            <small className="muted">
              {offer.price === null
                ? "Consulta no disponible"
                : "Último precio conservado"}
            </small>
          )}
        </span>
      ))}
    </span>
  );
}
