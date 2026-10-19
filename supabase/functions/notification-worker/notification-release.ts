import { recordRelease, releaseHasArrived } from "./releases.ts";
import type { JournalRecord } from "./types.ts";
type Candidate = Pick<JournalRecord, "year" | "release" | "sourceSnapshot"> & {
  releaseSince: string;
};
export function releaseNotificationDue(
  record: Candidate,
  now = new Date(),
): boolean {
  const release = recordRelease(record),
    since = new Date(record.releaseSince);
  if (release.kind !== "date" || !Number.isFinite(+since)) return false;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(since);
  const day = ["year", "month", "day"]
    .map((type) => parts.find((p) => p.type === type)!.value)
    .join("-");
  return release.value >= day && releaseHasArrived(record, now);
}
