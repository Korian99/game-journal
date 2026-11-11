import { parseRelease } from "@/lib/releases";
import type { JournalView } from "@/lib/journal/journal-location";
import type { JournalEntry } from "@/lib/journal/journal-types";

export function upcomingReleaseUpdate(
  view: JournalView,
  status: JournalEntry["status"],
  value?: string,
): { release: string; year: number } | null {
  if (view !== "upcoming" || status !== "upcoming" || !value) return null;
  const parsed = parseRelease(value);
  return "year" in parsed ? { release: parsed.value, year: parsed.year } : null;
}
