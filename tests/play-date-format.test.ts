import { expect, it } from "vitest";
import { dateOrder, formatDate } from "../src/lib/journal/view-config";
import { recordSchema } from "../src/lib/validation";
import { emptyRecord } from "../src/lib/types";
import {
  inlineCandidate,
  inlineUnchanged,
} from "../src/lib/journal/inline-editing";
import { periodAfterDateEdits } from "../src/lib/journal/entry-period";
import { statusAfterDateEdits } from "../src/lib/journal/entry-status";

it.each([
  ["1/2/26", "01/02/2026"],
  ["31/12/99", "31/12/1999"],
  ["1/1/00", "01/01/2000"],
  ["31/12/49", "31/12/2049"],
  ["1/1/50", "01/01/1950"],
  ["29/2/24", "29/02/2024"],
  ["1/2/2026", "01/02/2026"],
  ["2026-02-01", "01/02/2026"],
])("normalizes %s as %s", (raw, expected) => {
  expect(formatDate(raw)).toBe(expected);
  expect(dateOrder(raw)).toBe(dateOrder(expected));
});
it.each([
  "31/02/26",
  "29/02/25",
  "01/13/26",
  "01/01/2",
  "01/01/202",
  "01/01/20266",
])("does not guess or roll over invalid date %s", (raw) => {
  expect(dateOrder(raw)).toBeUndefined();
  expect(formatDate(raw)).toBe(raw);
});
it("canonicalizes valid saved play dates while retaining blank and legacy approximate values", () => {
  const saved = recordSchema.parse({
    ...emptyRecord,
    title: "Fixture",
    started: "31/12/25",
    finished: "2026-01-01",
  });
  expect(saved).toMatchObject({
    started: "31/12/2025",
    finished: "01/01/2026",
  });
  expect(
    recordSchema.parse({
      ...emptyRecord,
      title: "Fixture",
      started: null,
      finished: "No recuerdo",
    }),
  ).toMatchObject({ started: "", finished: "No recuerdo" });
});
it("uses short years for inline saves, derived status/period, and unchanged checks", () => {
  const entry = { ...emptyRecord, title: "Fixture", started: "31/12/2025" };
  expect(inlineUnchanged(entry, "started", "31/12/25")).toBe(true);
  expect(inlineCandidate(entry, "finished", "01/01/26")).toMatchObject({
    started: "31/12/2025",
    finished: "01/01/2026",
    period: "2025-2026",
    status: "completed",
  });
  const draft = { ...entry, finished: "01/01/26" };
  expect(periodAfterDateEdits(draft, entry)).toBe("2025-2026");
  expect(statusAfterDateEdits(draft, entry)).toBe("completed");
  expect(() => inlineCandidate(entry, "finished", "31/02/26")).toThrow();
});
