import type { Offer } from "../types";
import type { JournalEntry } from "./journal-types";
import { normalizedTitle } from "./duplicates";
import { wishlistPlatforms } from "../offers/wishlist-display";
import { dateOrder } from "./view-config";
export type SearchGroup = {
  key: string;
  title: string;
  entries: JournalEntry[];
  rank: number;
};

/** All records must come from the owner's active-records resource, not a filtered table. */
export function searchJournal(
  records: JournalEntry[],
  query: string,
  offers: Pick<Offer, "game_id" | "url">[] = [],
): SearchGroup[] {
  const needle = normalizedTitle(query);
  if (!needle) return [];
  const words = needle.split(" ");
  const groups = new Map<string, SearchGroup>();
  for (const entry of records) {
    if (!entry.id) continue;
    const key = entry.gameId ? "game:" + entry.gameId : "entry:" + entry.id;
    const title = normalizedTitle(entry.title);
    const secondary = normalizedTitle(
      [
        entry.device,
        entry.platforms,
        entry.period,
        ...wishlistPlatforms(
          entry,
          offers.filter((offer) => offer.game_id === entry.gameId),
        ),
      ].join(" "),
    );
    const rank =
      title === needle
        ? 0
        : title.startsWith(needle)
          ? 1
          : words.every((word) => title.includes(word))
            ? 2
            : words.every((word) => secondary.includes(word))
              ? 3
              : Infinity;
    const group = groups.get(key);
    if (group) {
      group.entries.push(entry);
      group.rank = Math.min(group.rank, rank);
    } else groups.set(key, { key, title: entry.title, entries: [entry], rank });
  }
  return [...groups.values()]
    .filter((group) => Number.isFinite(group.rank))
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        a.title.localeCompare(b.title, "es") ||
        a.key.localeCompare(b.key),
    )
    .map((group) => ({
      ...group,
      entries: group.entries.sort(
        (a, b) =>
          (dateOrder(b.started) ?? -Infinity) -
            (dateOrder(a.started) ?? -Infinity) ||
          (dateOrder(b.finished) ?? -Infinity) -
            (dateOrder(a.finished) ?? -Infinity) ||
          (a.id ?? "").localeCompare(b.id ?? ""),
      ),
    }));
}
