import { emptyRecord } from "../../src/lib/types";
export const backupOwner = "12121212-1212-4212-8212-121212121212";
export const gameId = "23232323-2323-4323-8323-232323232323";
export const recordId = "34343434-3434-4434-8434-343434343434";
export const runId = "45454545-4545-4545-8545-454545454545";
export function backupFixture() {
  const record = {
    ...emptyRecord,
    id: recordId,
    gameId,
    title: "Recovery fixture",
    status: "completed" as const,
    notes: "PRIVATE REVIEW",
    updated_at: "2026-10-21T06:00:00Z",
  };
  return {
    version: 4,
    kind: "game-journal-daily",
    ownerId: backupOwner,
    exportedAt: "2026-10-21T06:00:00Z",
    records: [record],
    trash: [],
    offers: [],
    priceHistory: [],
    sourceTables: {
      games: [
        {
          id: gameId,
          owner_id: backupOwner,
          data: { title: record.title },
          created_at: "2026-10-21T06:00:00Z",
        },
      ],
      playthroughs: [
        {
          id: recordId,
          game_id: gameId,
          owner_id: backupOwner,
          data: { status: record.status, notes: record.notes },
          source_key: null,
          source_snapshot: { original: "kept" },
          updated_at: record.updated_at,
          deleted_at: null,
        },
      ],
      imports: [],
      shared_entries: [],
      notifications: [],
      notification_preferences: {
        owner_id: backupOwner,
        discounts: true,
        targets: true,
        releases: true,
      },
      member: {
        id: backupOwner,
        display_name: "Fixture",
        role: "member",
        active: true,
      },
    },
  };
}
