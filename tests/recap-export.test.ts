import { expect, it } from "vitest";
import {
  recapMonthName,
  recapTextLines,
} from "../src/lib/journal/recap-export";

it("wraps long recap copy into a bounded number of canvas-safe lines", () => {
  const measure = (text: string) => text.length * 10;
  expect(
    recapTextLines("Una aventura muy larga para compartir", 100, measure, 2),
  ).toEqual(["Una", "aventura…"]);
  expect(recapTextLines("breve", 100, measure, 2)).toEqual(["breve"]);
});

it("keeps an unbroken word within the drawing width", () => {
  const measure = (text: string) => text.length * 10;
  expect(recapTextLines("supercalifragilistic", 40, measure, 1)).toEqual([
    "sup…",
  ]);
});

it("formats the selected UTC calendar month without Argentina day rollover", () => {
  expect(recapMonthName(5)).toBe("mayo");
});
