import type { Offer } from "../../lib/types";

export function WishlistPrice({ offers }: { offers: Offer[] }) {
  if (!offers.length) return <span className="muted">Sin precio</span>;
  return (
    <span className="wishlist-prices">
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
