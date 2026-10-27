import { expect, it } from "vitest";
import { emptyRecord } from "../src/lib/types";
import {
  quickDraft,
  quickFields,
  quickUnchanged,
} from "../src/lib/journal/quick-editing";
const base = {
  ...emptyRecord,
  id: "20000000-0000-4000-8000-000000000001",
  gameId: "30000000-0000-4000-8000-000000000001",
  title: "Fixture",
  status: "playing" as const,
  started: "2026-01-01",
  updated_at: "2026-10-26T12:00:00Z",
  notes: "Keep review",
  hours: 10,
  rating: 80,
  priority: "Migui",
};
it("changes only quick fields and preserves identity, revision, dates, and long reviews", () => {
  const saved = quickDraft(base, {
    ...quickFields(base),
    status: "paused",
    hours: "12.5",
    rating: "0",
  });
  expect(saved).toMatchObject({
    id: base.id,
    gameId: base.gameId,
    updated_at: base.updated_at,
    notes: "Keep review",
    started: "01/01/2026",
    status: "paused",
    hours: 12.5,
    rating: 0,
    priority: "Migui",
  });
});
it("recognizes empty fields, zero and equivalent numbers without changing untouched values", () => {
  expect(quickUnchanged(base, quickFields(base))).toBe(true);
  expect(quickUnchanged(base, { ...quickFields(base), hours: "10.00" })).toBe(
    true,
  );
  expect(quickUnchanged(base, { ...quickFields(base), hours: "0" })).toBe(
    false,
  );
  expect(
    quickDraft(base, { ...quickFields(base), rating: "", hours: "" }),
  ).toMatchObject({ hours: null, rating: null });
});
it("refuses invalid quick values without discarding the base", () => {
  expect(() =>
    quickDraft(base, { ...quickFields(base), rating: "101" }),
  ).toThrow();
  expect(() =>
    quickDraft(base, { ...quickFields(base), hours: "-1" }),
  ).toThrow();
  expect(() =>
    quickDraft(base, { ...quickFields(base), hours: "abc" }),
  ).toThrow();
  expect(base.hours).toBe(10);
});
