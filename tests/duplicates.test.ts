import { it, expect } from "vitest";
import { findDuplicates } from "../src/lib/journal/duplicates";
import { emptyRecord } from "../src/lib/types";
const existing = {
  ...emptyRecord,
  id: "one",
  gameId: "game-one",
  title: "Hollow Knight",
  pages: ["https://store.steampowered.com/app/367520/?cc=US"],
};
it("matches normalized names and region-independent store identity without matching sequels", () => {
  expect(
    findDuplicates({ ...emptyRecord, title: "HÓLLOW  KNIGHT!" }, [existing]),
  ).toHaveLength(1);
  expect(
    findDuplicates(
      {
        ...emptyRecord,
        title: "Different",
        pages: [
          "https://store.steampowered.com/app/367520/Hollow_Knight/?cc=AR",
        ],
      },
      [existing],
    ),
  ).toHaveLength(1);
  expect(
    findDuplicates({ ...emptyRecord, title: "Hollow Knight: Silksong" }, [
      existing,
    ]),
  ).toHaveLength(0);
});
it("never warns for another playthrough of the same game or merges separate games", () => {
  expect(
    findDuplicates({ ...existing, id: undefined }, [existing]),
  ).toHaveLength(0);
  expect(
    findDuplicates({ ...existing, title: "Other" }, [existing]),
  ).toHaveLength(0);
  expect(existing.title).toBe("Hollow Knight");
});

it("includes separately stored offers in duplicate warnings", () => {
  expect(
    findDuplicates(
      {
        ...emptyRecord,
        title: "Another name",
        pages: ["https://store.steampowered.com/app/367520/?cc=AR"],
      },
      [{ ...existing, pages: [] }],
      [{ game_id: existing.gameId, url: existing.pages[0] }],
    ),
  ).toHaveLength(1);
});
