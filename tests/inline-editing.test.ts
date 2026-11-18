import { expect, it } from "vitest";
import {
  inlineCandidate,
  inlineUnchanged,
  inlineChange,
  undoCandidate,
  mergeSavedEntry,
} from "../src/features/journal/inline-editing";
import { emptyRecord } from "../src/lib/types";
const entry = {
  ...emptyRecord,
  id: "20000000-0000-4000-8000-000000000001",
  gameId: "30000000-0000-4000-8000-000000000001",
  title: "Original",
  updated_at: "2026-10-23T12:00:00Z",
};
it("validates and normalizes inline values without dropping the revision", () => {
  expect(inlineCandidate(entry, "hours", "0")).toMatchObject({
    hours: 0,
    updated_at: entry.updated_at,
  });
  expect(inlineCandidate(entry, "rating", "").rating).toBeNull();
  expect(inlineCandidate(entry, "title", "  Renamed  ").title).toBe("Renamed");
  expect(() => inlineCandidate(entry, "rating", "101")).toThrow();
  expect(() => inlineCandidate(entry, "title", " ")).toThrow();
  expect(() => inlineCandidate(entry, "started", "31/02/2026")).toThrow();
});
it("edits a private next-session reminder independently from review comments", () => {
  const reviewed = { ...entry, review_details: "Review comment", reminder: "" };
  const saved = inlineCandidate(reviewed, "reminder", "Try the alternate route");
  expect(saved).toMatchObject({ reminder: "Try the alternate route", review_details: "Review comment" });
  const restored = undoCandidate(saved, inlineChange(reviewed, saved, "Recordatorio"));
  expect(restored).toMatchObject({ reminder: "", review_details: "Review comment" });
});
it("keeps automatic dates/status/period behavior for inline edits", () => {
  const started = inlineCandidate(entry, "started", "31/12/2025");
  expect(started).toMatchObject({ status: "playing", period: "2025" });
  expect(inlineCandidate(started, "finished", "01/01/2026")).toMatchObject({
    status: "completed",
    period: "2025-2026",
  });
});
it("undo restores only changed values, including derived fields, while retaining later unrelated edits", () => {
  const saved = {
    ...inlineCandidate(entry, "started", "31/12/2025"),
    updated_at: "2026-10-23T13:00:00Z",
  };
  const change = inlineChange(entry, saved, "Empecé");
  expect(
    undoCandidate({ ...saved, review_details: "Keep later notes" }, change),
  ).toMatchObject({
    started: "",
    period: "",
    status: "wishlist",
    review_details: "Keep later notes",
    updated_at: saved.updated_at,
  });
  expect(() =>
    undoCandidate({ ...saved, started: "2024-01-01" }, change),
  ).toThrow();
});
it("updates shared game fields across replays without copying playthrough data", () => {
  const other = { ...entry, id: "other", hours: 30, rating: 80 };
  const saved = { ...entry, title: "Renamed", hours: 5 };
  expect(mergeSavedEntry([entry, other], saved)).toMatchObject([
    { title: "Renamed", hours: 5 },
    { title: "Renamed", hours: 30, rating: 80 },
  ]);
});

it("undo restores a legacy release year instead of retaining the newly explicit release", () => {
  const legacy = { ...entry, year: 2024, release: undefined };
  const saved = inlineCandidate(legacy, "release", "2027-winter");
  const reverted = undoCandidate(
    saved,
    inlineChange(legacy, saved, "Lanzamiento"),
  );
  expect(reverted).toMatchObject({ release: "2024", year: 2024 });
});

it("recognizes unchanged display values and equivalent field formatting without deriving other fields", () => {
  const saved = {
    ...entry,
    title: "Original",
    rating: 80,
    started: "2026-01-01",
    period: "",
    year: 2024,
    release: undefined,
  };
  expect(inlineUnchanged(saved, "title", "Original")).toBe(true);
  expect(inlineUnchanged(saved, "title", "  Original  ")).toBe(true);
  expect(inlineUnchanged(saved, "rating", "80.00")).toBe(true);
  expect(inlineUnchanged(saved, "started", "01/01/2026")).toBe(true);
  expect(inlineUnchanged(saved, "release", "2024")).toBe(true);
  expect(inlineUnchanged(saved, "hours", "")).toBe(true);
  expect(inlineUnchanged(saved, "title", "Different")).toBe(false);
  expect(inlineUnchanged(saved, "title", "")).toBe(false);
  expect(inlineUnchanged(saved, "rating", "bad")).toBe(false);
  expect(inlineUnchanged(saved, "started", "31/02/2026")).toBe(false);
});


it("keeps Recuerdo through inline play date edits while deriving the period", () => {
  const remembered = { ...entry, status: "remembered" as const };
  const started = inlineCandidate(remembered, "started", "31/12/2025");
  expect(started).toMatchObject({ status: "remembered", period: "2025" });
  const finished = inlineCandidate(started, "finished", "01/01/2026");
  expect(finished).toMatchObject({ status: "remembered", period: "2025-2026" });
  const corrected = inlineCandidate(finished, "finished", "02/01/2026");
  expect(corrected.status).toBe("remembered");
  expect(inlineCandidate(corrected, "finished", "").status).toBe("remembered");
  const wishlist = inlineCandidate(corrected, "status", "wishlist");
  expect(inlineCandidate(wishlist, "finished", "03/01/2026").status).toBe("completed");
});
