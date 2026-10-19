import { expect, it } from "vitest";
import { emptyRecord } from "../src/lib/types";
import { summarizeGames } from "../src/lib/view-summary";

it("counts recorded start and finish dates and sums played hours", () => {
  const summary = summarizeGames([
    {
      ...emptyRecord,
      started: "2026-01-01",
      finished: "02/02/2026",
      hours: 12.5,
      status: "completed",
    },
    {
      ...emptyRecord,
      started: "03/04/2026",
      finished: "No",
      hours: 0,
      status: "playing",
    },
    { ...emptyRecord, started: "?", finished: "31/02/2026", hours: null },
  ]);
  expect(summary).toMatchObject({
    total: 3,
    started: 2,
    finished: 1,
    hours: 12.5,
    hoursCount: 2,
    playing: 1,
  });
});
it("averages recorded reviews, including zero, without treating blanks as zero", () => {
  expect(
    summarizeGames([
      { ...emptyRecord, rating: 80 },
      { ...emptyRecord, rating: 0 },
      { ...emptyRecord, rating: null },
    ]),
  ).toMatchObject({ averageRating: 40, ratingCount: 2 });
  expect(summarizeGames([])).toMatchObject({
    total: 0,
    started: 0,
    finished: 0,
    hours: 0,
    averageRating: null,
    consoles: [],
  });
});
it("groups games by console actually played, merging casing and counting each console once per entry", () => {
  expect(
    summarizeGames([
      { ...emptyRecord, device: "PC; pc; Nintendo DS", platforms: "Xbox 360" },
      { ...emptyRecord, device: "PC" },
      { ...emptyRecord, device: "   ", platforms: "PC" },
    ]).consoles,
  ).toEqual([
    { name: "PC", count: 2 },
    { name: "Nintendo DS", count: 1 },
    { name: "Sin consola registrada", count: 1 },
  ]);
});

it("counts starts and finishes within the selected year while keeping totals for visible games", () => {
  const records = [
    {
      ...emptyRecord,
      started: "2025-11-01",
      finished: "2026-01-01",
      hours: 10,
    },
    { ...emptyRecord, started: "2026-02-01", finished: "", hours: 5 },
  ];
  expect(summarizeGames(records, "2026")).toMatchObject({
    total: 2,
    started: 1,
    finished: 1,
    hours: 15,
  });
  expect(summarizeGames(records)).toMatchObject({ started: 2, finished: 1 });
});
