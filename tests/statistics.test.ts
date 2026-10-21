import { it, expect } from "vitest";
import { emptyRecord } from "../src/lib/types";
import { estimateHours, statistics } from "../src/lib/journal/statistics";
it("accepts clear triples or story-only numbers, skipping ambiguous estimates", () => {
  expect(estimateHours("10 - 15 - 30", "extras")).toBe(15);
  expect(estimateHours("10,5 / 20 / 35 h", "completionist")).toBe(35);
  expect(estimateHours("12", "story")).toBe(12);
  for (const text of ["10 - 20", "10 a 20", "10?", "30 - 20 - 10"])
    expect(estimateHours(text, "story")).toBeNull();
  expect(estimateHours("12", "extras")).toBeNull();
});
it("uses Biblioteca cohorts, distinguishes unique games and never duplicates device hours", () => {
  const game = "game",
    base = {
      ...emptyRecord,
      gameId: game,
      status: "completed" as const,
      started: "2025-12-15",
      finished: "2026-01-10",
      hours: 10,
      device: "PC; Switch",
      estimated: "8 - 10 - 15",
      rating: 80,
    };
  const data = statistics(
    [
      base,
      {
        ...base,
        id: "replay",
        started: "2026-02-01",
        finished: "",
        status: "paused",
        hours: 5,
        device: "PC",
        rating: null,
      },
      { ...base, id: "old", finished: "2025-12-20", hours: 100 },
    ],
    { year: "2026", target: "story" },
  );
  expect(data.total).toBe(2);
  expect(data.uniqueGames).toBe(1);
  expect(data.started).toBe(1);
  expect(data.finished).toBe(1);
  expect(data.completionRate).toBe(50);
  expect(data.hours).toBe(15);
  expect(data.ratingCount).toBe(1);
  expect(data.averageRating).toBe(80);
  expect(data.estimatedHours).toBe(16);
  expect(data.estimateCount).toBe(2);
  expect(data.consoles.reduce((sum, item) => sum + item.hours, 0)).toBe(15);
  expect(
    data.consoles.find((item) => item.name === "Varias consolas")?.hours,
  ).toBe(10);
});
