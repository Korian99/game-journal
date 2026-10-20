import type { JournalRecord } from "@/lib/types";

export type JournalEntry = JournalRecord & { gameId?: string };
export type PerformJournalAction = (
  action: () => Promise<unknown>,
  successMessage?: string,
) => Promise<boolean>;
