import { expect, it } from "vitest";
import { emptyRecord } from "../src/lib/types";
import { summarizeGames } from "../src/lib/journal/view-summary";

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

it("finds the highest average among consoles with at least five played games", () => {
  const records = [
    { ...emptyRecord, device: "PC", rating: 80, impression: "10" },
    { ...emptyRecord, device: "pc", impression: "9" },
    { ...emptyRecord, device: "Nintendo DS", rating: 90 },
    { ...emptyRecord, device: "Nintendo DS", rating: 70 },
  ].flatMap((record) => Array.from({ length: 3 }, () => ({ ...record })));
  expect(summarizeGames(records).bestRatedConsole).toEqual({
    name: "PC",
    averageScore: 85,
    ratingCount: 6,
    playedCount: 6,
  });
});
it("counts played games separately from scores, including a zero review", () => {
  expect(
    summarizeGames([
      { ...emptyRecord, device: "PC; pc", rating: 0 },
      ...Array.from({ length: 5 }, () => ({ ...emptyRecord, device: "PC" })),
      { ...emptyRecord, device: "PC; Nintendo DS", rating: 100 },
      { ...emptyRecord, device: "", rating: 100, platforms: "Nintendo DS" },
      {
        ...emptyRecord,
        device: "Nintendo DS",
        impression: "Epico",
        memorability: 10,
      },
      { ...emptyRecord, device: "Nintendo DS", rating: NaN },
    ]).bestRatedConsole,
  ).toEqual({ name: "PC", averageScore: 0, ratingCount: 1, playedCount: 6 });
});
it("breaks score ties by sample count then name among eligible consoles", () => {
  const records = [
    ...Array.from({ length: 6 }, () => ({
      ...emptyRecord,
      device: "Xbox 360",
      rating: 90,
    })),
    ...Array.from({ length: 7 }, () => ({
      ...emptyRecord,
      device: "PC",
      rating: 90,
    })),
  ];
  expect(summarizeGames(records).bestRatedConsole).toEqual({
    name: "PC",
    averageScore: 90,
    ratingCount: 7,
    playedCount: 7,
  });
  expect(summarizeGames(records.slice(0, 12)).bestRatedConsole?.name).toBe(
    "PC",
  );
});
it("requires at least five games even when a smaller sample has a higher score", () => {
  const pc = Array.from({ length: 4 }, () => ({
    ...emptyRecord,
    device: "PC",
    rating: 100,
  }));
  const ds = Array.from({ length: 5 }, () => ({
    ...emptyRecord,
    device: "Nintendo DS",
    rating: 80,
  }));
  expect(summarizeGames(pc).bestRatedConsole).toBeNull();
  expect(
    summarizeGames([...pc, { ...pc[0], device: "PC; Nintendo DS" }])
      .bestRatedConsole,
  ).toBeNull();
  expect(summarizeGames([...pc, ...ds]).bestRatedConsole?.name).toBe(
    "Nintendo DS",
  );
  expect(summarizeGames([...pc, { ...pc[0] }]).bestRatedConsole?.name).toBe(
    "PC",
  );
});
it("uses canonical Emulador labels for console counts and eligibility", () => {
  const records = [
    "Emulacion",
    "Emulators",
    "GBA Emulator",
    "Emulado",
    "PSP Emulator",
    "Emulador; Emulators",
  ].map((device) => ({ ...emptyRecord, device, rating: 80 }));
  const result = summarizeGames(records);
  expect(result.consoles).toEqual([{ name: "Emulador", count: 6 }]);
  expect(result.bestRatedConsole).toEqual({
    name: "Emulador",
    averageScore: 80,
    ratingCount: 6,
    playedCount: 6,
  });
});
it("returns no best console without usable scores", () => {
  expect(summarizeGames([]).bestRatedConsole).toBeNull();
  expect(
    summarizeGames(
      Array.from({ length: 6 }, () => ({
        ...emptyRecord,
        device: "PC",
        impression: "Sin puntaje",
      })),
    ).bestRatedConsole,
  ).toBeNull();
});
