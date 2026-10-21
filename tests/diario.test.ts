import { expect, it } from "vitest";
import {
  viewStatuses,
  journalReviewOrder,
} from "../src/lib/journal/view-config";
import {
  readJournalLocation,
  writeJournalLocation,
} from "../src/lib/journal/journal-location";
it("includes remembered, playing, completed, abandoned and paused entries in Diario", () => {
  expect(new Set(viewStatuses.journal)).toEqual(
    new Set(["remembered", "playing", "completed", "abandoned", "paused"]),
  );
  expect(viewStatuses.journal).not.toContain("wishlist");
  expect(viewStatuses.journal).not.toContain("upcoming");
});
it("keeps a Diario status filter and combined rating sort in a bookmark", () => {
  const state = readJournalLocation(
    "?tab=journal&year=all&status=paused&sort=rating.desc,title.asc",
    "2026",
  );
  expect(state.status).toBe("paused");
  expect(state.sort[0]).toEqual({ id: "rating", desc: true });
  expect(readJournalLocation(writeJournalLocation(state), "2026")).toEqual(
    state,
  );
  expect(
    readJournalLocation("?tab=journal&status=wishlist", "2026").status,
  ).toBe("");
});
it("uses review first, then numeric impressions scaled to 100, preserving zero", () => {
  expect(journalReviewOrder({ rating: 82, impression: "10" })).toBe(82);
  expect(journalReviewOrder({ rating: null, impression: "8" })).toBe(80);
  expect(journalReviewOrder({ rating: 0, impression: "10" })).toBe(0);
  expect(journalReviewOrder({ rating: null, impression: "0" })).toBe(0);
  expect(journalReviewOrder({ rating: null, impression: "8,5" })).toBe(85);
});
it.each(["", "  ", "Épico", "8/10", "11", "-1", "Infinity"])(
  "does not invent a score for impressions %s",
  (impression) => {
    expect(journalReviewOrder({ rating: null, impression })).toBeUndefined();
  },
);
