import type { JournalRecord, Status } from "../types";
import { dateOrder } from "./view-config";
import { recordRelease, releaseHasArrived } from "../releases";

type DatedEntry = Pick<JournalRecord, "started" | "finished" | "status">;

type NewEntryRelease = Pick<
  JournalRecord,
  "id" | "release" | "year" | "sourceSnapshot" | "status"
> & { gameId?: string };

export function defaultNewEntryStatus(
  entry: NewEntryRelease,
  now = new Date(),
  upcomingQuote = false,
): Status {
  if (entry.id || entry.gameId) return entry.status;

  const release = recordRelease(entry);
  if (release.kind === "date")
    return releaseHasArrived(entry, now) ? "wishlist" : "upcoming";

  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
  }).formatToParts(now);
  const currentYear = Number(parts.find((part) => part.type === "year")!.value);
  if (release.kind === "year" || release.kind === "season") {
    if (release.year > currentYear) return "upcoming";
    return upcomingQuote ? "upcoming" : "wishlist";
  }
  return upcomingQuote ? "upcoming" : "wishlist";
}

export function statusAfterDateEdits(
  draft: DatedEntry,
  original?: DatedEntry,
): Status {
  const started = dateOrder(draft.started);
  const finished = dateOrder(draft.finished);
  const startChanged =
    started !== undefined && started !== dateOrder(original?.started ?? "");
  const finishChanged =
    finished !== undefined && finished !== dateOrder(original?.finished ?? "");

  if (!startChanged && !finishChanged) return draft.status;
  if (finished !== undefined) return "completed";
  return "playing";
}

/** Fill only the matching missing date on a saved status transition. */
export function datesAfterStatusChange(
  draft: DatedEntry,
  original?: Pick<DatedEntry, "status">,
  now = new Date(),
): Pick<DatedEntry, "started" | "finished"> {
  const dates = { started: draft.started, finished: draft.finished };
  if (!original || draft.status === original.status) return dates;
  const field =
    draft.status === "playing"
      ? "started"
      : draft.status === "completed"
        ? "finished"
        : null;
  if (!field || dates[field].trim()) return dates;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  dates[field] = ["year", "month", "day"]
    .map((type) => parts.find((part) => part.type === type)!.value)
    .join("-");
  return dates;
}
