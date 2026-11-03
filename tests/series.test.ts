import { expect, it } from "vitest";
import {
  seriesDeleteSchema,
  seriesSaveSchema,
  reorderSeriesGames,
  getSeriesProgress,
} from "../src/lib/series";
import { emptyRecord } from "../src/lib/types";

const play = (
  gameId: string,
  status: typeof emptyRecord.status,
  extra = {},
) => ({
  ...emptyRecord,
  gameId,
  title: gameId,
  status,
  ...extra,
});

const games = [
  "10000000-0000-4000-8000-000000000001",
  "10000000-0000-4000-8000-000000000002",
  "10000000-0000-4000-8000-000000000003",
];

it("counts each member once when any active replay is completed, retaining manual order", () => {
  const progress = getSeriesProgress(
    [games[1], games[0], games[2]],
    [
      play(games[0], "completed"),
      play(games[0], "completed"),
      play(games[0], "playing"),
      play(games[1], "paused"),
      play("outside", "completed"),
    ],
  );
  expect(progress.total).toBe(3);
  expect(progress.completed).toBe(1);
  expect(progress.games.map((g) => g.gameId)).toEqual([
    games[1],
    games[0],
    games[2],
  ]);
  expect(progress.next?.gameId).toBe(games[1]);
});

it("only completed status qualifies, independently of completion dates", () => {
  for (const status of [
    "playing",
    "paused",
    "abandoned",
    "remembered",
    "wishlist",
    "upcoming",
  ] as const)
    expect(
      getSeriesProgress(
        [games[0]],
        [play(games[0], status, { finished: "2026-01-01" })],
      ).completed,
    ).toBe(0);
  expect(
    getSeriesProgress([games[0]], [play(games[0], "completed")]).completed,
  ).toBe(1);
});

it("trash and restore change progress without changing membership", () => {
  const completed = play(games[0], "completed");
  const trashed = { ...completed, deleted_at: "2026-11-03T12:00:00Z" };
  expect(getSeriesProgress(games, [completed, trashed]).completed).toBe(1);
  const afterTrash = getSeriesProgress(games, [trashed]);
  expect(afterTrash.completed).toBe(0);
  expect(afterTrash.total).toBe(3);
  expect(afterTrash.games[0]).toMatchObject({
    title: "Juego no disponible",
    available: false,
  });
  expect(
    getSeriesProgress(games, [{ ...trashed, deleted_at: null }]).completed,
  ).toBe(1);
  expect(getSeriesProgress(games.slice(1), []).total).toBe(2);
});

it("uses available artwork across replays and retains manual cover overrides", () => {
  const cover = {
    provider: "steam" as const,
    providerUrl: "https://shared.fastly.steamstatic.com/cover.jpg",
    overrideUrl: "https://assets.nintendo.com/override.jpg",
  };
  const result = getSeriesProgress(
    [games[0]],
    [
      play(games[0], "playing"),
      play(games[0], "completed", { title: "Title", cover }),
    ],
  );
  expect(result.games[0].cover).toEqual(cover);
  expect(result.games[0].available).toBe(true);
  expect(result.next).toBeUndefined();
  expect(getSeriesProgress([], []).total).toBe(0);
  expect(getSeriesProgress([], []).next).toBeUndefined();
});

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
