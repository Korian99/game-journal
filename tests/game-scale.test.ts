import { expect, it } from "vitest";
import { recordSchema } from "../src/lib/validation";
import { readJournalLocation, writeJournalLocation } from "../src/lib/journal/journal-location";
import { mergeSavedEntry } from "../src/features/journal/inline-editing";
import { emptyRecord } from "../src/lib/types";

it("accepts only the supported production scales and keeps legacy scale unspecified", () => {
  const record = { title: "Game", year: null, platforms: "", device: "", period: "", started: "", finished: "", status: "wishlist", ownership: "No", priority: null, hype: "", hours: null, estimated: "", rating: null, memorability: null, impression: "", focus: "", replay: "", reason: "", notes: "", sourceKey: "" };
  expect(recordSchema.parse({ ...record, scale: "indie" }).scale).toBe("indie");
  expect(recordSchema.parse(record)).not.toHaveProperty("scale");
  expect(recordSchema.safeParse({ ...record, scale: "long" }).success).toBe(false);
});

it("persists an Escala filter in journal URLs", () => {
  const state = readJournalLocation("?tab=library&scale=aa", "2026");
  expect(state.scale).toBe("aa");
  expect(readJournalLocation(writeJournalLocation(state, ""), "2026").scale).toBe("aa");
  expect(writeJournalLocation({ ...readJournalLocation("?tab=statistics", "2026"), scale: "aa" }, "")).not.toContain("scale=");
});

it("propagates a cleared shared game scale to every replay", () => {
  const first = { ...emptyRecord, id: "play-1", gameId: "game-1", scale: "aa" as const };
  const replay = { ...emptyRecord, id: "play-2", gameId: "game-1", scale: "aa" as const };
  expect(mergeSavedEntry([first, replay], { ...first, scale: null })[1].scale).toBeNull();
});
