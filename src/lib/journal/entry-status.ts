import type { JournalRecord, Status } from "../types";
import { dateOrder } from "./view-config";

type DatedEntry = Pick<JournalRecord, "started" | "finished" | "status">;

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
