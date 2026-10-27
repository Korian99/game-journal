import { expect, it } from "vitest";
import type { JournalEntry } from "../src/lib/journal/journal-types";
import { emptyRecord, type Status } from "../src/lib/types";
import { gameSuggestions } from "../src/lib/journal/suggestions";
import {
  readJournalLocation,
  writeJournalLocation,
} from "../src/lib/journal/journal-location";
const now = new Date("2026-10-26T15:00:00Z");
const record = (id: string, patch: Partial<JournalEntry> = {}) => ({
  ...emptyRecord,
  id,
  gameId: id,
  title: id,
  status: "wishlist" as Status,
  ownership: "Si",
  estimated: "10",
  platforms: "PC",
  ...patch,
});
const options = {
  platform: "",
  maxHours: null as number | null,
  target: "story" as const,
  includeUnknownEstimates: false,
};
const suggest = (
  records: ReturnType<typeof record>[],
  patch: Partial<typeof options> = {},
) => gameSuggestions(records, [], { ...options, ...patch }, now);
it("includes unstarted owned and paused family entries, but excludes abandoned and other states", () => {
  const rows = [
    record("unstarted"),
    record("paused", {
      status: "paused",
      ownership: "En Familia",
      started: "2020-01-01",
    }),
    ...(
      [
        "playing",
        "completed",
        "abandoned",
        "remembered",
        "upcoming",
      ] as Status[]
    ).map((status) => record(status, { status })),
    record("not-owned", { ownership: "No" }),
    record("unknown-access", { ownership: "" }),
    record("old-period", { period: "2014" }),
    record("already-started", { started: "No recuerdo" }),
    record("already-ended", { finished: "01/01/2020" }),
  ];
  expect(suggest(rows).items.map((item) => item.entry.id)).toEqual([
    "paused",
    "unstarted",
  ]);
});
it("prefers the paused playthrough and never repeats a game or merges equal titles", () => {
  const rows = [
    record("new", { title: "Same", gameId: "one" }),
    record("paused", {
      title: "Same",
      gameId: "one",
      status: "paused",
      started: "2026-01-01",
    }),
    record("separate", { title: "Same", gameId: "two" }),
  ];
  const result = suggest(rows);
  expect(result.eligibleCount).toBe(2);
  expect(result.items.map((item) => item.entry.id)).toContain("paused");
  expect(result.items.map((item) => item.entry.id)).not.toContain("new");
});
it("ranks numeric priorities before text and unknowns, then known Hype, then title", () => {
  const rows = [
    record("Text", { priority: "Migui", hype: "Hyper" }),
    record("Numeric 10", { priority: 10 }),
    record("Numeric 2", { priority: "2" }),
    record("Bajo", { hype: "Bajo" }),
    record("Dunno", { hype: "Dunno" }),
    record("Medio", { hype: "Medio" }),
    record("Hyper", { hype: "Hyper" }),
    record("Alto", { hype: "Alto" }),
  ];
  expect(suggest(rows).items.map((item) => item.entry.title)).toEqual([
    "Numeric 2",
    "Numeric 10",
    "Hyper",
    "Text",
    "Alto",
    "Medio",
    "Bajo",
    "Dunno",
  ]);
});
it("uses total estimated duration without subtracting recorded hours", () => {
  const rows = [
    record("long", { status: "paused", estimated: "20", hours: 15 }),
    record("short", { estimated: "8" }),
    record("range", { estimated: "8-12" }),
    record("missing", { estimated: "" }),
    record("zero", { estimated: "0" }),
  ];
  const result = suggest(rows, { maxHours: 10 });
  expect(result.items.map((item) => item.entry.id)).toEqual(["short", "zero"]);
  expect(result.excluded.duration).toBe(1);
  expect(result.unknownEstimates).toBe(2);
  expect(result.excluded.unknownEstimate).toBe(2);
  const inclusive = suggest(rows, {
    maxHours: 10,
    includeUnknownEstimates: true,
  });
  expect(inclusive.items).toHaveLength(4);
  expect(
    inclusive.items.find((item) => item.entry.id === "range")?.estimatedHours,
  ).toBeNull();
});
it("uses only supported estimate targets and preserves the original text", () => {
  const rows = [
    record("single", { estimated: "8" }),
    record("triple", { estimated: "5 - 10 - 20" }),
  ];
  const result = gameSuggestions(
    rows,
    [],
    { ...options, target: "extras", maxHours: 12 },
    now,
  );
  expect(result.items.map((item) => item.entry.id)).toEqual(["triple"]);
  expect(result.items[0].estimatedHours).toBe(10);
  expect(result.items[0].entry.estimated).toBe("5 - 10 - 20");
});
it("uses available platforms and page identities, not played devices, as console evidence", () => {
  const rows = [
    record("metadata", { platforms: "Nintendo Switch 2" }),
    record("device-only", { platforms: "", device: "PC", status: "paused" }),
    record("page", {
      platforms: "",
      pages: ["https://store.steampowered.com/app/620/"],
    }),
  ];
  const pc = suggest(rows, { platform: "PC" });
  expect(pc.items.map((item) => item.entry.id)).toEqual(["page"]);
  expect(pc.excluded.unknownPlatform).toBe(1);
  expect(pc.platforms).toEqual(["PC", "Switch 2"]);
  expect(
    suggest(rows, { platform: "Switch 2" }).items.map((item) => item.entry.id),
  ).toEqual(["metadata"]);
});
it("excludes known future releases in Argentina and marks approximate dates as uncertain", () => {
  const rows = [
    record("future-date", { release: "2026-10-27" }),
    record("future-year", { release: "2027" }),
    record("future-season", { release: "2027-summer" }),
    record("approx", { release: "2026-winter" }),
    record("unknown", { year: null }),
  ];
  const result = suggest(rows);
  expect(result.items.map((item) => item.entry.id)).toEqual([
    "approx",
    "unknown",
  ]);
  expect(result.items.every((item) => item.releaseUncertain)).toBe(true);
  const nearMidnight = gameSuggestions(
    [record("tomorrow", { release: "2026-10-26" })],
    [],
    options,
    new Date("2026-10-26T01:00:00Z"),
  );
  expect(nearMidnight.items).toHaveLength(0);
});
it("does not mutate records, offers or silently relax filters", () => {
  const rows = [record("one", { platforms: "PC", estimated: "50" })],
    snapshot = JSON.stringify(rows);
  expect(
    suggest(rows, { platform: "Switch", maxHours: 10 }).items,
  ).toHaveLength(0);
  expect(JSON.stringify(rows)).toBe(snapshot);
});
it("persists only valid suggestion controls in URLs", () => {
  const state = readJournalLocation(
    "tab=suggestions&platform=Nintendo+Switch+2&maxHours=10&estimateTarget=extras&unknownEstimates=include",
  );
  expect(state).toMatchObject({
    view: "suggestions",
    platform: "Switch 2",
    suggestionHours: "10",
    estimateTarget: "extras",
    suggestionUnknownEstimates: true,
  });
  expect(readJournalLocation(writeJournalLocation(state))).toEqual(state);
  expect(
    readJournalLocation("tab=suggestions&maxHours=-1&estimateTarget=bad"),
  ).toMatchObject({ suggestionHours: "", estimateTarget: "story" });
  expect(
    readJournalLocation("tab=library&maxHours=10&unknownEstimates=include"),
  ).toMatchObject({ suggestionHours: "", suggestionUnknownEstimates: false });
});

it("does not mistake logged play time for an unstarted game or choose an input-order-dependent replay", () => {
  const first = record("a", {
    gameId: "shared",
    status: "paused",
    started: "01/01/2025",
  });
  const second = record("b", {
    gameId: "shared",
    status: "paused",
    started: "01/01/2025",
  });
  expect(suggest([record("logged", { hours: 1 })]).items).toHaveLength(0);
  expect(suggest([first, second]).items.map((item) => item.entry.id)).toEqual(
    suggest([second, first]).items.map((item) => item.entry.id),
  );
});
