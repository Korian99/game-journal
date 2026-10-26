import { describe, expect, it } from "vitest";
import { emptyRecord } from "../src/lib/types";
import { searchJournal } from "../src/lib/journal/search";
import { entryDestination } from "../src/lib/journal/entry-destination";

const record = (id: string, title: string, gameId = id) => ({
  ...emptyRecord,
  id,
  gameId,
  title,
});
describe("global search", () => {
  it("ranks title matches ahead of secondary fields and normalizes accents and punctuation", () => {
    const records = [
      { ...record("secondary", "Other"), device: "Pokémon" },
      record("partial", "New Pokémon adventure"),
      record("prefix", "Pokémon Azul"),
      record("exact", "Pokémon"),
    ];
    expect(
      searchJournal(records, "POKEMON!").map((group) => group.key),
    ).toEqual(["game:exact", "game:prefix", "game:partial", "game:secondary"]);
    expect(searchJournal(records, "!!!")).toEqual([]);
    expect(searchJournal(records, "")).toEqual([]);
  });
  it("groups replays by identity while keeping separate games with identical titles distinct", () => {
    const first = {
      ...record("first", "Final Fantasy VII", "game"),
      device: "PC",
      period: "2024",
    };
    const replay = {
      ...record("replay", "Final Fantasy VII", "game"),
      device: "Switch",
      started: "2026-01-01",
    };
    const other = record("other", "Final Fantasy VII", "different");
    const groups = searchJournal([first, replay, other], "Final VII");
    expect(groups).toHaveLength(2);
    expect(
      groups
        .find((group) => group.key === "game:game")
        ?.entries.map((entry) => entry.id),
    ).toEqual(["replay", "first"]);
    expect(searchJournal([first, replay], "PC")[0].entries).toHaveLength(2);
  });
  it("searches periods and available consoles without mutating the input", () => {
    const rows = [
      {
        ...record("one", "Alpha"),
        platforms: "PC; Switch",
        period: "2010-2014",
      },
    ];
    expect(searchJournal(rows, "2010")[0].entries[0]).toBe(rows[0]);
    expect(searchJournal(rows, "Switch")).toHaveLength(1);
    expect(rows[0].title).toBe("Alpha");
    expect(
      searchJournal([{ ...emptyRecord, title: "Unsaved draft" }], "Unsaved"),
    ).toEqual([]);
  });
});
it.each([
  ["wishlist", "wishlist"],
  ["upcoming", "upcoming"],
  ["remembered", "journal"],
  ["playing", "library"],
  ["paused", "library"],
  ["completed", "library"],
  ["abandoned", "library"],
] as const)("navigates %s to %s", (status, view) => {
  expect(entryDestination({ ...record("entry", "Game"), status })).toEqual({
    view,
    entryId: "entry",
  });
});

it("recognizes consoles from added pages even when platform metadata is missing", () => {
  const pageOnly = {
    ...record("steam", "Portal"),
    pages: ["https://store.steampowered.com/app/620/Portal_2/"],
  };
  expect(searchJournal([pageOnly], "PC")).toHaveLength(1);
});
