import type { JournalRecord, Offer } from "./types";

function pagePlatform(raw: string): string | undefined {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password || url.port)
      return;
    const host = url.hostname,
      path = url.pathname.toLowerCase();
    if (host === "store.steampowered.com" && /^\/app\/\d+(?:\/|$)/.test(path))
      return "PC";
    if (host === "store.epicgames.com" && /\/p\/[^/]+/.test(path)) return "PC";
    if (["gog.com", "www.gog.com"].includes(host) && /\/game\/[^/]+/.test(path))
      return "PC";
    if (!["www.nintendo.com", "nintendo.com"].includes(host)) return;
    if (/\/games\/nintendo-ds\//.test(path)) return "Nintendo DS";
    if (/\/games\/nintendo-3ds-games\//.test(path)) return "Nintendo 3DS";
    const product = /\/store\/products\/([^/]+)\/?$/.exec(path)?.[1];
    if (!product) return;
    if (/-switch-2(?:-edition)?$/.test(product)) return "Nintendo Switch 2";
    if (/-switch$/.test(product)) return "Nintendo Switch";
  } catch {
    /* An unrecognized reference page does not establish a platform. */
  }
}
export function wishlistPlatforms(
  record: Pick<JournalRecord, "pages">,
  offers: Pick<Offer, "url">[],
): string[] {
  const platforms = new Set(
    [...offers.map((offer) => offer.url), ...(record.pages ?? [])]
      .map(pagePlatform)
      .filter(Boolean),
  );
  return [
    "PC",
    "Nintendo Switch",
    "Nintendo Switch 2",
    "Nintendo DS",
    "Nintendo 3DS",
  ].filter((platform) => platforms.has(platform));
}
export function hasActiveDiscount(
  offers: Pick<Offer, "price" | "discount" | "status" | "error">[],
): boolean {
  return offers.some(
    (offer) =>
      !offer.error &&
      ["available", "early_access", "upcoming", "free"].includes(
        offer.status,
      ) &&
      offer.price !== null &&
      Number.isFinite(offer.price) &&
      offer.price >= 0 &&
      offer.discount > 0 &&
      offer.discount <= 100,
  );
}
