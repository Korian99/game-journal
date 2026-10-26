import type { JournalEntry } from "./journal-types";
import type { JournalView } from "./journal-location";

/** Resolve an exact playthrough independently of the current filters. */
export function entryDestination(entry: JournalEntry): {
  view: JournalView;
  entryId: string;
} {
  const view =
    entry.status === "wishlist" || entry.status === "upcoming"
      ? entry.status
      : entry.status === "remembered"
        ? "journal"
        : "library";
  return { view, entryId: entry.id ?? "" };
}
