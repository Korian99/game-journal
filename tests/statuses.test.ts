import { expect, it } from "vitest";
import { emptyRecord, statuses } from "../src/lib/types";
import { recordSchema } from "../src/lib/validation";
import { journalEntrySchema } from "../src/lib/contracts";
import { parseWorkbook } from "../src/lib/domain";

it("offers only active states and starts new records in wishlist", () => {
  expect(Object.values(statuses)).not.toContain("Pendiente");
  expect(Object.keys(statuses)).not.toContain("backlog");
  expect(emptyRecord.status).toBe("wishlist");
});
it("reads legacy pending entries as wishlist without losing their data", () => {
  const entry = journalEntrySchema.parse({
    ...emptyRecord,
    title: "Old game",
    status: "backlog",
    notes: "My review",
    priority: 2,
  });
  expect(entry).toMatchObject({
    title: "Old game",
    status: "wishlist",
    notes: "My review",
    priority: 2,
  });
});
it("normalizes legacy client saves while rejecting unknown statuses", () => {
  expect(
    recordSchema.parse({ ...emptyRecord, title: "Old game", status: "backlog" })
      .status,
  ).toBe("wishlist");
  expect(
    recordSchema.safeParse({
      ...emptyRecord,
      title: "Old game",
      status: "nonsense",
    }).success,
  ).toBe(false);
});
it("imports unfinished entries with no state into wishlist", () => {
  const entries = parseWorkbook([
    {
      name: "2026",
      values: [
        ["Juego", "Termine"],
        ["Imported game", ""],
      ],
    },
  ]);
  expect(entries[0].status).toBe("wishlist");
});
