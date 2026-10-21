import type { Offer } from "../types";
import type { JournalEntry } from "./journal-types";
export const normalizedTitle = (title: string) =>
  title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
export function canonicalStoreIdentity(page: string): string | null {
  try {
    const url = new URL(page);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    if (url.hostname === "store.steampowered.com") {
      const id = /^\/app\/(\d+)(?:\/|$)/.exec(url.pathname)?.[1];
      return id ? "steam:" + id : null;
    }
    if (["nintendo.com", "www.nintendo.com"].includes(url.hostname)) {
      const slug = /^\/[^/]+\/store\/products\/([a-z0-9-]+)\/?$/i.exec(
        url.pathname,
      )?.[1];
      return slug ? "nintendo:" + slug.toLowerCase() : null;
    }
  } catch {}
  return null;
}
export function findDuplicates(
  candidate: JournalEntry,
  records: JournalEntry[],
  offers: Pick<Offer, "game_id" | "url">[] = [],
): JournalEntry[] {
  const title = normalizedTitle(candidate.title),
    identities = new Set(
      (candidate.pages ?? []).map(canonicalStoreIdentity).filter(Boolean),
    );
  const seen = new Set<string>();
  return records.filter((record) => {
    if (
      (record.id === candidate.id && candidate.id) ||
      (record.gameId && record.gameId === candidate.gameId)
    )
      return false;
    const matches =
      (!!title && normalizedTitle(record.title) === title) ||
      [
        ...(record.pages ?? []),
        ...offers
          .filter((offer) => offer.game_id === record.gameId)
          .map((offer) => offer.url),
      ].some((page) => {
        const id = canonicalStoreIdentity(page);
        return !!id && identities.has(id);
      });
    const key = record.gameId ?? record.id ?? record.title;
    if (!matches || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
