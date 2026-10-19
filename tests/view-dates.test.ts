import { expect, it } from "vitest";
import {
  reviewOrder,
  dateOrder,
  periodOrder,
  currentYear,
  matchesViewYear,
  viewYears,
} from "../src/lib/view-config";

it("sorts ISO and Argentine day/month dates consistently", () => {
  expect(dateOrder("02/10/2026")).toBe(dateOrder("2026-10-02"));
  expect(dateOrder("18/10/2026")!).toBeGreaterThan(dateOrder("2026-10-02")!);
  expect(dateOrder("2025-11-25")!).toBeLessThan(dateOrder("02/10/2026")!);
});
it("keeps missing and invalid dates out of chronological ordering", () => {
  for (const value of ["", "?", "No", "31/02/2026", "2026-13-01"])
    expect(dateOrder(value)).toBeUndefined();
  expect(dateOrder("2024-02-29")).toBeDefined();
});
it("orders historical periods by their first year without changing source text", () => {
  expect(periodOrder("2004 - 2008")).toBe(2004);
  expect(periodOrder("2014 - 2018")!).toBeLessThan(periodOrder("2020")!);
  expect(periodOrder("?")).toBeUndefined();
});

it("uses the current year in Argentina, including the New Year timezone boundary", () => {
  expect(currentYear(new Date("2027-06-15T12:00:00Z"))).toBe("2027");
  expect(currentYear(new Date("2027-01-01T01:00:00Z"))).toBe("2026");
});
it("includes games finished in the selected year regardless of when they started", () => {
  expect(
    matchesViewYear(
      { started: "2025-11-01", finished: "02/01/2026", period: "" },
      "library",
      "2026",
    ),
  ).toBe(true);
  expect(
    matchesViewYear(
      { started: "", finished: "2026-12-31", period: "" },
      "library",
      "2026",
    ),
  ).toBe(true);
});
it("includes unfinished games only in their start year", () => {
  expect(
    matchesViewYear(
      { started: "01/01/2026", finished: "", period: "" },
      "library",
      "2026",
    ),
  ).toBe(true);
  expect(
    matchesViewYear(
      { started: "2025-11-01", finished: "", period: "" },
      "library",
      "2026",
    ),
  ).toBe(false);
  expect(
    matchesViewYear(
      { started: "", finished: "", period: "" },
      "library",
      "2026",
    ),
  ).toBe(false);
});
it("assigns games with a finish date to the finish year instead of the start year", () => {
  const record = { started: "2026-01-01", finished: "2027-01-01", period: "" };
  expect(matchesViewYear(record, "library", "2026")).toBe(false);
  expect(matchesViewYear(record, "library", "2027")).toBe(true);
});
it("matches a selected year within historical periods and supports all years", () => {
  const record = { started: "", finished: "", period: "2014 - 2018" };
  expect(matchesViewYear(record, "journal", "2016")).toBe(true);
  expect(matchesViewYear(record, "journal", "2019")).toBe(false);
  expect(matchesViewYear({ ...record, period: "?" }, "journal", "2016")).toBe(
    false,
  );
  expect(matchesViewYear({ ...record, period: "?" }, "journal", "")).toBe(true);
  expect(matchesViewYear(record, "wishlist", "2026")).toBe(true);
});
it("offers every year between recorded years and the current year", () => {
  expect(
    viewYears(
      [{ started: "2024-01-01", finished: "2027-01-01", period: "" }],
      "library",
      "2026",
    ),
  ).toEqual(["2027", "2026", "2025", "2024"]);
  expect(
    viewYears(
      [{ started: "", finished: "", period: "2022 - 2024" }],
      "journal",
      "2026",
    ),
  ).toEqual(["2026", "2025", "2024", "2023", "2022"]);
});

it("compares displayed reviews and memorability on the same scale", () => {
  expect(reviewOrder({ rating: null, memorability: 9 })).toBe(90);
  expect(reviewOrder({ rating: 80, memorability: 1 })).toBe(80);
  expect(reviewOrder({ rating: 0, memorability: 10 })).toBe(0);
  expect(reviewOrder({ rating: null, memorability: 0 })).toBe(0);
  expect(reviewOrder({ rating: null, memorability: null })).toBeUndefined();
});

it("includes year-only imports in Biblioteca without inventing dates", () => {
  const record = { started: "", finished: "", period: "2025" };
  expect(matchesViewYear(record, "library", "2025")).toBe(true);
  expect(matchesViewYear(record, "library", "2026")).toBe(false);
  expect(viewYears([record], "library", "2026")).toEqual(["2026", "2025"]);
  expect(record).toEqual({ started: "", finished: "", period: "2025" });
});
it("uses exact dates before the imported year when dates are available", () => {
  for (const record of [
    { started: "2026-02-01", finished: "", period: "2025" },
    { started: "2025-02-01", finished: "2026-02-01", period: "2025" },
  ]) {
    expect(matchesViewYear(record, "library", "2025")).toBe(false);
    expect(matchesViewYear(record, "library", "2026")).toBe(true);
  }
  expect(
    viewYears(
      [{ started: "2026-02-01", finished: "", period: "2020" }],
      "library",
      "2026",
    ),
  ).toEqual(["2026"]);
});
it("keeps imports with an unknown year available through all years", () => {
  const record = { started: "", finished: "", period: "?" };
  expect(matchesViewYear(record, "library", "2025")).toBe(false);
  expect(matchesViewYear(record, "library", "")).toBe(true);
});
