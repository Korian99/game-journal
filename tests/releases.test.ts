import { expect, it } from "vitest";
import * as releases from "../src/lib/releases";
import { defaultViewSort } from "../src/lib/view-config";
import { recordSchema } from "../src/lib/validation";
import { emptyRecord } from "../src/lib/types";

it("sorts Próximos by release ascending by default", () => {
  expect(defaultViewSort("upcoming")).toEqual([
    { id: "year", desc: false },
    { id: "title", desc: false },
  ]);
});
it("puts exact dates first, then seasons by year, year-only values, and unknowns", () => {
  const values = [
    "",
    "2027",
    "2028-winter",
    "2027-summer",
    "2029-01-02",
    "2027-spring",
    "2028-01-01",
    "2026",
    "2027-autumn",
    "2027-winter",
  ];
  expect(
    values.sort(
      (a, b) =>
        (releases.releaseOrder({ release: a, year: null }) ?? Infinity) -
        (releases.releaseOrder({ release: b, year: null }) ?? Infinity),
    ),
  ).toEqual([
    "2028-01-01",
    "2029-01-02",
    "2027-spring",
    "2027-summer",
    "2027-autumn",
    "2027-winter",
    "2028-winter",
    "2026",
    "2027",
    "",
  ]);
});
it("preserves old year-only records and displays exact dates without timezone shifts", () => {
  expect(releases.releaseLabel({ year: 2027 })).toBe("2027");
  expect(releases.releaseLabel({ release: "2027-01-02", year: 2027 })).toBe(
    "02/01/2027",
  );
  expect(releases.releaseLabel({ release: "2027-autumn", year: 2027 })).toBe(
    "Otoño 2027",
  );
  expect(releases.releaseLabel({ year: null })).toBe("Sin fecha");
  expect(releases.releaseOrder({ year: 2027 })).toBe(
    releases.releaseOrder({ release: "2027", year: null }),
  );
});
it("validates actual calendar dates, seasons, year bounds, and unknown values", () => {
  for (const release of [
    "2028-02-29",
    "2027-spring",
    "2027-summer",
    "2027-autumn",
    "2027-winter",
    "2027",
    "",
  ]) {
    const parsed = recordSchema.parse({
      ...emptyRecord,
      title: "Game",
      release,
    });
    expect(parsed.release).toBe(release);
  }
  for (const release of [
    "2027-02-29",
    "2027-13-01",
    "2027-02-30",
    "2027-monsoon",
    "tomorrow",
    "2201",
    "1949",
    "2027-01-01T23:00:00Z",
  ]) {
    expect(
      recordSchema.safeParse({ ...emptyRecord, title: "Game", release })
        .success,
      release,
    ).toBe(false);
  }
  expect(releases.releaseOrder({ release: "TBA", year: null })).toBeUndefined();
});
it("synchronizes the legacy year from the release value and preserves legacy requests", () => {
  expect(
    recordSchema.parse({
      ...emptyRecord,
      title: "Game",
      release: "2027-winter",
      year: 2026,
    }).year,
  ).toBe(2027);
  const { release: ignored, ...legacy } = {
    ...emptyRecord,
    title: "Game",
    release: "",
  };
  expect(recordSchema.parse({ ...legacy, year: 2024 }).year).toBe(2024);
});

it("keeps precision groups and unknowns in place when reversing within groups", () => {
  const exact = { release: "2029-01-02", year: null },
    season = { release: "2027-spring", year: null },
    year = { year: 2026 },
    unknown = { year: null };
  for (const descending of [false, true]) {
    const compare = (
      a: Parameters<typeof releases.compareReleases>[0],
      b: Parameters<typeof releases.compareReleases>[1],
    ) => releases.compareReleases(a, b, descending) * (descending ? -1 : 1);
    expect(compare(exact, season)).toBeLessThan(0);
    expect(compare(season, year)).toBeLessThan(0);
    expect(compare(year, unknown)).toBeLessThan(0);
    expect(compare(unknown, unknown) === 0).toBe(true);
  }
});

it("clears the legacy release year when explicitly set to unknown", () => {
  expect(
    recordSchema.parse({
      ...emptyRecord,
      title: "Game",
      year: 2027,
      release: "",
    }).year,
  ).toBeNull();
});

it("uses imported release cells when older entries have no explicit release value", () => {
  const sourceSnapshot = (value: string | number) => ({
    raw: { cells: [{ header: "Fecha de Salida", value }] },
  });
  expect(
    releases.releaseLabel({
      year: 2026,
      sourceSnapshot: sourceSnapshot(46317),
    }),
  ).toBe("22/10/2026");
  expect(
    releases.releaseLabel({
      year: null,
      sourceSnapshot: sourceSnapshot("En 2026 (Primavera)"),
    }),
  ).toBe("Primavera 2026");
  expect(
    releases.releaseLabel({
      year: null,
      sourceSnapshot: sourceSnapshot("En 2026 (Verano)"),
    }),
  ).toBe("Verano 2026");
  expect(
    releases.releaseLabel({
      year: null,
      sourceSnapshot: sourceSnapshot("En 2027"),
    }),
  ).toBe("2027");
  expect(
    releases.releaseLabel({
      year: null,
      sourceSnapshot: sourceSnapshot("Unknown"),
    }),
  ).toBe("Sin fecha");
});
it("lets explicit release edits and cleared dates override imported snapshots", () => {
  const record = {
    year: null,
    sourceSnapshot: {
      raw: { cells: [{ header: "Fecha de Salida", value: 46317 }] },
    },
  };
  expect(releases.releaseLabel({ ...record, release: "2028-winter" })).toBe(
    "Invierno 2028",
  );
  expect(releases.releaseLabel({ ...record, release: "" })).toBe("Sin fecha");
});

it("highlights exact releases on or before today's date in Argentina", () => {
  const record = { year: 2026, release: "2026-10-19" };
  expect(
    releases.releaseHasArrived(record, new Date("2026-10-19T02:59:59Z")),
  ).toBe(false);
  expect(
    releases.releaseHasArrived(record, new Date("2026-10-19T03:00:00Z")),
  ).toBe(true);
  expect(
    releases.releaseHasArrived(
      { ...record, release: "2026-10-18" },
      new Date("2026-10-19T03:00:00Z"),
    ),
  ).toBe(true);
  expect(
    releases.releaseHasArrived(
      { ...record, release: "2026-10-20" },
      new Date("2026-10-19T03:00:00Z"),
    ),
  ).toBe(false);
});
it("does not assume a release day from a season, year, or unknown date", () => {
  const now = new Date("2026-10-19T15:00:00Z");
  for (const record of [
    { year: 2025 },
    { year: 2025, release: "2025-spring" },
    { year: null, release: "" },
    { year: null, release: "not a date" },
  ]) {
    expect(releases.releaseHasArrived(record, now)).toBe(false);
  }
});
it("recognizes imported exact release dates without changing the entry's status", () => {
  const record = {
    year: null,
    status: "upcoming",
    sourceSnapshot: {
      raw: { cells: [{ header: "Fecha de Salida", value: 46317 }] },
    },
  };
  expect(
    releases.releaseHasArrived(record, new Date("2026-10-23T15:00:00Z")),
  ).toBe(true);
  expect(record.status).toBe("upcoming");
});
