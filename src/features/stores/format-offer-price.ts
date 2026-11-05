import type { Offer } from "@/lib/types";

export const formatOfferPrice = (offer: Offer) =>
  offer.price === null
    ? "Sin precio"
    : new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: offer.currency ?? "USD",
      }).format(offer.price) +
      " " +
      (offer.currency ?? "");
