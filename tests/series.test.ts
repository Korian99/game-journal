import { expect, it } from "vitest";
import {
  seriesDeleteSchema,
  seriesSaveSchema,
  reorderSeriesGames,
} from "../src/lib/series";

const games = [
  "10000000-0000-4000-8000-000000000001",
  "10000000-0000-4000-8000-000000000002",
  "10000000-0000-4000-8000-000000000003",
];

it("normalizes a series name and retains the entire ordered membership list", () => {
  expect(
    seriesSaveSchema.parse({ name: "  Trilogía  ", gameIds: games }),
  ).toEqual({
    name: "Trilogía",
    gameIds: games,
  });
});

it("rejects empty, oversized, duplicate, or invalid series membership data", () => {
  for (const value of [
    { name: "   ", gameIds: [] },
    { name: "x".repeat(81), gameIds: [] },
    { name: "Valid", gameIds: [games[0], games[0]] },
    { name: "Valid", gameIds: ["not-an-id"] },
  ])
    expect(seriesSaveSchema.safeParse(value).success).toBe(false);
});

it("reorders membership immutably without dropping unlisted or unavailable games", () => {
  const moved = reorderSeriesGames(games, games[2], "up");
  expect(moved).toEqual([games[0], games[2], games[1]]);
  expect(new Set(moved)).toEqual(new Set(games));
  expect(games).toEqual([
    "10000000-0000-4000-8000-000000000001",
    "10000000-0000-4000-8000-000000000002",
    "10000000-0000-4000-8000-000000000003",
  ]);
  expect(reorderSeriesGames(games, "unknown", "down")).toEqual(games);
});

it("accepts PostgreSQL offset timestamps for revision-checked deletes", () => {
  expect(
    seriesDeleteSchema.safeParse({
      id: games[0],
      updatedAt: "2026-10-21T06:00:00+00:00",
    }).success,
  ).toBe(true);
  expect(
    seriesDeleteSchema.safeParse({ id: games[0], updatedAt: "not-a-timestamp" })
      .success,
  ).toBe(false);
});
