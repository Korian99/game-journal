import type { JournalRecord } from "../types";
import { dateOrder } from "./view-config";

type PeriodEntry = Pick<JournalRecord, "started" | "finished" | "period">;

/** Derive the played years on date edits; preserve manually entered approximations otherwise. */
export function periodAfterDateEdits(
  draft: PeriodEntry,
  original?: PeriodEntry,
): string {
  const started = dateOrder(draft.started);
  const finished = dateOrder(draft.finished);
  const datesChanged =
    started !== dateOrder(original?.started ?? "") ||
    finished !== dateOrder(original?.finished ?? "");
  if (draft.period.trim() && !datesChanged) return draft.period;
  const startYear =
    started === undefined ? undefined : new Date(started).getUTCFullYear();
  const finishYear =
    finished === undefined ? undefined : new Date(finished).getUTCFullYear();
  if (
    startYear !== undefined &&
    finishYear !== undefined &&
    startYear !== finishYear
  )
    return startYear + "-" + finishYear;
  const year = startYear ?? finishYear;
  return year === undefined ? draft.period : String(year);
}
