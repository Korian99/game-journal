import { expect, it } from "vitest";
import { reminderForSave } from "../src/lib/journal/record-reminder";
import { journalEntrySchema, sharedEntrySchema } from "../src/lib/contracts";

it("preserves a saved reminder for older clients but accepts an explicit clear", () => {
  expect(reminderForSave(undefined, "Check route", false)).toBe("Check route");
  expect(reminderForSave("", "Check route", true)).toBe("");
  expect(reminderForSave("New note", "Old note", true)).toBe("New note");
});

it("does not backfill reminders from legacy review comments or include reminders in shared records", () => {
  const legacy = journalEntrySchema.parse({
    title: "Old game",
    status: "playing",
    notes: "Old review",
  });
  expect(legacy).toMatchObject({ review_details: "Old review", reminder: "" });
  const shared = sharedEntrySchema.parse({
    shareId: "share",
    owner: "Owner",
    title: "Shared game",
    hours: null,
    rating: null,
    memorability: null,
    reminder: "Private reminder",
  });
  expect(shared).not.toHaveProperty("reminder");
});
