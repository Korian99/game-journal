import type { Offer } from "../types";
export type OfferTargetUpdate = { id: string; target_price: number | null };
export function offerTargetChanges(
  offers: Pick<Offer, "id" | "target_price">[],
  drafts: Record<string, string>,
): { updates: OfferTargetUpdate[]; invalidOfferId: string | null } {
  const updates: OfferTargetUpdate[] = [];
  for (const offer of offers) {
    if (!Object.hasOwn(drafts, offer.id)) continue;
    const text = drafts[offer.id].trim();
    const target = text === "" ? null : Number(text);
    if (target !== null && (!Number.isFinite(target) || target < 0))
      return { updates: [], invalidOfferId: offer.id };
    if (target !== offer.target_price)
      updates.push({ id: offer.id, target_price: target });
  }
  return { updates, invalidOfferId: null };
}
