import type { JournalEntry } from "./journal-types";
import type { Offer } from "../types";
import { estimateHours, type EstimateTarget } from "./statistics";
import { getOwnershipInfo } from "./ownership";
import { normalizeConsoleLabels } from "./console-labels";
import { wishlistPlatforms } from "../offers/wishlist-display";
import { recordRelease, releaseHasArrived } from "../releases";
import { dateOrder } from "./view-config";
export type SuggestionOptions = {
  platform: string;
  maxHours: number | null;
  target: EstimateTarget;
  includeUnknownEstimates: boolean;
};
export type GameSuggestion = {
  entry: JournalEntry;
  platforms: string[];
  estimatedHours: number | null;
  releaseUncertain: boolean;
};
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
export function numericPriority(
  value: JournalEntry["priority"],
): number | null {
  if (value === null || String(value).trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
function hypeRank(value: string) {
  return (
    ({ hyper: 0, alto: 1, medio: 2, bajo: 3 } as Record<string, number>)[
      normalize(value)
    ] ?? 4
  );
}
function compare(a: JournalEntry, b: JournalEntry) {
  const first = numericPriority(a.priority),
    second = numericPriority(b.priority);
  return (
    (first === null
      ? second === null
        ? 0
        : 1
      : second === null
        ? -1
        : first - second) ||
    hypeRank(a.hype) - hypeRank(b.hype) ||
    a.title.localeCompare(b.title, "es", { sensitivity: "base" }) ||
    (a.id ?? "").localeCompare(b.id ?? "")
  );
}
/** Suggestions read active owner records only. Unknown release precision is shown, never invented. */
export function gameSuggestions(
  records: JournalEntry[],
  offers: Pick<Offer, "game_id" | "url">[],
  options: SuggestionOptions,
  now = new Date(),
) {
  const year = Number(
    new Intl.DateTimeFormat("en", {
      timeZone: "America/Buenos_Aires",
      year: "numeric",
    }).format(now),
  );
  const grouped = new Map<string, JournalEntry>();
  for (const entry of records) {
    const access = getOwnershipInfo(entry.ownership).className;
    if (!["owned", "family"].includes(access)) continue;
    if (
      entry.status !== "paused" &&
      !(
        entry.status === "wishlist" &&
        !entry.started.trim() &&
        !entry.finished.trim() &&
        !entry.period.trim() &&
        !(entry.hours !== null && entry.hours > 0)
      )
    )
      continue;
    const release = recordRelease(entry);
    if (
      release.kind === "date"
        ? !releaseHasArrived(entry, now)
        : release.kind !== "unknown" && release.year > year
    )
      continue;
    const key = entry.gameId ?? entry.id ?? entry.sourceKey;
    const previous = grouped.get(key);
    // A paused playthrough represents the game the user intends to return to.
    const newerPaused =
      previous && entry.status === "paused" && previous.status === "paused"
        ? (dateOrder(entry.started) ?? 0) - (dateOrder(previous.started) ?? 0)
        : 0;
    if (
      !previous ||
      (entry.status === "paused" && previous.status !== "paused") ||
      (entry.status === previous.status &&
        (newerPaused > 0 ||
          (newerPaused === 0 && compare(entry, previous) < 0)))
    )
      grouped.set(key, entry);
  }
  const eligible = Array.from(grouped.values())
    .sort(compare)
    .map((entry): GameSuggestion => {
      const labels = [
        ...normalizeConsoleLabels(entry.platforms).split(";"),
        ...wishlistPlatforms(
          entry,
          offers.filter(
            (offer) => !!entry.gameId && offer.game_id === entry.gameId,
          ),
        ),
      ];
      const platforms = Array.from(
        new Map(
          labels
            .map((label) => label.trim())
            .filter(Boolean)
            .map((label) => [normalize(label), label]),
        ).values(),
      );
      const release = recordRelease(entry);
      return {
        entry,
        platforms,
        estimatedHours: estimateHours(entry.estimated, options.target),
        releaseUncertain:
          release.kind === "unknown" ||
          (release.kind !== "date" && release.year >= year),
      };
    });
  const platforms = Array.from(
    new Map(
      eligible
        .flatMap((item) => item.platforms)
        .map((label) => [normalize(label), label]),
    ).values(),
  ).sort((a, b) => a.localeCompare(b, "es"));
  const excluded = {
    platform: 0,
    unknownPlatform: 0,
    duration: 0,
    unknownEstimate: 0,
  };
  let unknownEstimates = 0;
  const items = eligible.filter((item) => {
    if (
      options.platform &&
      !item.platforms.some(
        (platform) => normalize(platform) === normalize(options.platform),
      )
    ) {
      if (!item.platforms.length) excluded.unknownPlatform++;
      else excluded.platform++;
      return false;
    }
    if (item.estimatedHours === null) {
      unknownEstimates++;
      if (options.maxHours !== null && !options.includeUnknownEstimates) {
        excluded.unknownEstimate++;
        return false;
      }
    } else if (
      options.maxHours !== null &&
      item.estimatedHours > options.maxHours
    ) {
      excluded.duration++;
      return false;
    }
    return true;
  });
  return {
    items,
    platforms,
    eligibleCount: eligible.length,
    unknownEstimates,
    excluded,
  };
}
