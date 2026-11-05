import { expect, it } from "vitest";
import { emptyRecord } from "../src/lib/types";
import type { JournalEntry } from "../src/lib/journal/journal-types";
import { calculateRecap } from "../src/features/statistics/recaps";

const entry = (
  values: Partial<JournalEntry> & Pick<JournalEntry, "id">,
): JournalEntry => ({ ...emptyRecord, ...values });

it("counts completed playthroughs with full finish dates and unique stable game identities", () => {
  const entries = [
    entry({
      id: "p1",
      gameId: "game-a",
      title: "Same title",
      status: "completed",
      finished: "2026-05-01",
    }),
    entry({
      id: "p2",
      gameId: "game-a",
      title: "Same title",
      status: "completed",
      finished: "2026-05-31",
    }),
    entry({
      id: "p3",
      gameId: "game-b",
      title: "Same title",
      status: "completed",
      finished: "2026-05-15",
    }),
    entry({
      id: "p4",
      gameId: "game-c",
      title: "Later",
      status: "completed",
      finished: "2026-06-01",
    }),
    entry({
      id: "p5",
      gameId: "game-d",
      title: "Not done",
      status: "paused",
      finished: "2026-05-10",
    }),
  ];
  expect(
    calculateRecap(entries, {
      period: { type: "month", year: 2026, month: 5 },
    }),
  ).toMatchObject({
    finishedPlaythroughs: 3,
    uniqueGamesFinished: 2,
    recordedStarts: 0,
    excludedCompletedWithoutFullFinishDate: 0,
  });
});

it("uses date-only calendar days and Argentina calendar dates for timestamps", () => {
  const entries = [
    entry({
      id: "day",
      gameId: "a",
      status: "completed",
      finished: "2026-05-01",
    }),
    entry({
      id: "local",
      gameId: "b",
      status: "completed",
      finished: "01/05/2026",
    }),
    entry({
      id: "timestamp-in",
      gameId: "c",
      status: "completed",
      finished: "2026-05-01T02:30:00Z",
    }),
    entry({
      id: "timestamp-out",
      gameId: "d",
      status: "completed",
      finished: "2026-05-01T03:00:00Z",
    }),
    entry({
      id: "start",
      gameId: "e",
      status: "playing",
      started: "2026-05-31T02:30:00Z",
    }),
  ];
  const may = calculateRecap(entries, {
    period: { type: "month", year: 2026, month: 5 },
  });
  expect(may.finishedPlaythroughs).toBe(3);
  expect(may.recordedStarts).toBe(1);
});

it("counts only precise full dates and explains completed entries with unusable finish dates", () => {
  const entries = [
    entry({ id: "year", status: "completed", finished: "2026" }),
    entry({ id: "approx", status: "completed", finished: "~2026-05-10" }),
    entry({ id: "missing", status: "completed", finished: "" }),
    entry({ id: "invalid", status: "completed", finished: "2026-02-30" }),
    entry({
      id: "valid",
      gameId: "valid",
      status: "completed",
      finished: "2026-05-10",
    }),
    entry({ id: "non-complete", status: "abandoned", finished: "2026" }),
  ];
  expect(
    calculateRecap(entries, { period: { type: "year", year: 2026 } }),
  ).toMatchObject({
    finishedPlaythroughs: 1,
    uniqueGamesFinished: 1,
    excludedCompletedWithoutFullFinishDate: 4,
    excludedFinishDateReasons: {
      missing: 1,
      partial: 1,
      approximate: 1,
      invalid: 1,
    },
  });
});

it("uses the timestamp's Argentina year for year periods and defaults current period using explicit now", () => {
  const entries = [
    entry({
      id: "dec",
      gameId: "a",
      status: "completed",
      finished: "2026-12-31T23:30:00-03:00",
    }),
    entry({
      id: "jan",
      gameId: "b",
      status: "completed",
      finished: "2027-01-01T02:30:00Z",
    }),
  ];
  expect(
    calculateRecap(entries, { period: { type: "year", year: 2026 } })
      .finishedPlaythroughs,
  ).toBe(2);
  expect(
    calculateRecap([], { now: new Date("2027-01-01T01:00:00Z") }).period,
  ).toEqual({
    type: "month",
    year: 2026,
    month: 12,
  });
});

it("returns zero metrics for empty periods and does not mutate input", () => {
  const entries = [
    entry({
      id: "one",
      status: "completed",
      finished: "2026-01-01",
      started: "2025-01-01",
    }),
  ];
  const before = structuredClone(entries);
  expect(
    calculateRecap(entries, {
      period: { type: "month", year: 2026, month: 2 },
    }),
  ).toMatchObject({
    finishedPlaythroughs: 0,
    uniqueGamesFinished: 0,
    recordedStarts: 0,
    excludedCompletedWithoutFullFinishDate: 0,
  });
  expect(entries).toEqual(before);
});

it("does not merge distinct same-title games when stable game IDs are missing or different", () => {
  const result = calculateRecap(
    [
      entry({
        id: "a",
        gameId: "identity-a",
        title: "Twin",
        status: "completed",
        finished: "2026-01-02",
      }),
      entry({
        id: "b",
        gameId: "identity-b",
        title: "Twin",
        status: "completed",
        finished: "2026-01-03",
      }),
      entry({
        id: "c",
        title: "Twin",
        status: "completed",
        finished: "2026-01-04",
      }),
      entry({
        id: "d",
        title: "Twin",
        status: "completed",
        finished: "2026-01-05",
      }),
    ],
    { period: { type: "year", year: 2026 } },
  );
  expect(result.uniqueGamesFinished).toBe(4);
});

it("ignores trashed records that appear in defensive owner projections", () => {
  const trashed = {
    ...entry({
      id: "trash",
      gameId: "trash-game",
      status: "completed",
      finished: "2026-01-10",
    }),
    deleted_at: "2026-02-01T00:00:00Z",
  } as JournalEntry;
  const result = calculateRecap([trashed], {
    period: { type: "year", year: 2026 },
  });
  expect(result.finishedPlaythroughs).toBe(0);
  expect(result.recordedStarts).toBe(0);
  expect(result.excludedCompletedWithoutFullFinishDate).toBe(0);
});

it("rejects impossible calendar and clock values in timestamps", () => {
  const result = calculateRecap(
    [
      entry({
        id: "bad-day",
        status: "completed",
        finished: "2026-02-30T12:00:00Z",
      }),
      entry({
        id: "bad-time",
        status: "completed",
        finished: "2026-02-28T25:00:00Z",
      }),
      entry({
        id: "bad-suffix",
        status: "completed",
        finished: "2026-02-28Tunknown",
      }),
    ],
    { period: { type: "year", year: 2026 } },
  );
  expect(result.finishedPlaythroughs).toBe(0);
  expect(result.excludedFinishDateReasons.invalid).toBe(3);
});

it("does not infer activity from release or period metadata and separates identity key namespaces", () => {
  const result = calculateRecap(
    [
      entry({
        id: "same",
        gameId: "same",
        title: "A",
        status: "completed",
        finished: "2026-01-02",
      }),
      entry({
        id: "same",
        title: "B",
        status: "completed",
        finished: "2026-01-03",
      }),
      entry({
        id: "metadata",
        title: "C",
        status: "completed",
        period: "2026",
        year: 2026,
        release: "2026-01-01",
      }),
    ],
    { period: { type: "year", year: 2026 } },
  );
  expect(result.finishedPlaythroughs).toBe(2);
  expect(result.uniqueGamesFinished).toBe(2);
  expect(result.recordedStarts).toBe(0);
  expect(result.excludedCompletedWithoutFullFinishDate).toBe(1);
});
