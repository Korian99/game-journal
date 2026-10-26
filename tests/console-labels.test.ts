import { expect, it } from "vitest";
import { emptyRecord } from "../src/lib/types";
import { recordSchema } from "../src/lib/validation";
import { journalEntrySchema, sharedEntrySchema } from "../src/lib/contracts";
import { makeImportPlan, parseWorkbook } from "../src/lib/domain";

it.each([
  "Emulacion",
  "Emulación",
  "Emulado",
  "Emulador",
  "Emuladores",
  "Emulator",
  "Emulators",
  "GBA Emulator",
  "PSP Emulator",
  "PC (emulation)",
])(
  "standardizes %s in console fields without editing review text",
  (device) => {
    const input = {
      ...emptyRecord,
      title: "Fixture",
      device,
      platforms: "PC; " + device,
      notes: "Me gustó jugar con emulación",
      impression: "Emulation worked well",
    };
    const saved = recordSchema.parse(input);
    expect(saved).toMatchObject({
      device: "Emulador",
      platforms: "PC; Emulador",
      notes: input.notes,
      impression: input.impression,
    });
    expect(journalEntrySchema.parse(input)).toMatchObject({
      device: "Emulador",
      platforms: "PC; Emulador",
      notes: input.notes,
    });
  },
);
it("keeps genuine console names and deduplicates emulation labels", () => {
  expect(
    recordSchema.parse({
      ...emptyRecord,
      title: "Fixture",
      device: "Nintendo DS; GBA Emulator; Emulators",
    }).device,
  ).toBe("Nintendo DS; Emulador");
  expect(
    journalEntrySchema.parse({
      ...emptyRecord,
      device: "Nintendo Switch 2",
      platforms: "PC; PlayStation 5",
    }),
  ).toMatchObject({
    device: "Switch 2",
    platforms: "PC; PlayStation 5",
  });
});
it("normalizes shared console labels", () => {
  const shared = sharedEntrySchema.parse({
    shareId: "share",
    owner: "Fixture",
    title: "Shared",
    device: "PSP Emulator",
    hours: null,
    rating: null,
    memorability: null,
  });
  expect(shared.device).toBe("Emulador");
});
it("normalizes imported consoles while preserving the spreadsheet source", () => {
  const row = parseWorkbook([
    {
      name: "<2025",
      values: [
        ["Juego", "Consola"],
        ["Fixture", "GBA Emulator"],
      ],
    },
  ])[0];
  expect(row.device).toBe("Emulador");
  expect(row.raw?.consola).toBe("GBA Emulator");
  const old = {
    ...row,
    id: "record",
    device: "PC",
    sourceSnapshot: { ...row, device: "GBA Emulator" },
  };
  const plan = makeImportPlan([row], [old])[0];
  expect(plan.conflicts).not.toContain("device");
  expect(plan.changes.device).toBeUndefined();
});

it("normalizes console names in bookmarked filters", async () => {
  const { readJournalLocation } =
    await import("../src/lib/journal/journal-location");
  expect(
    readJournalLocation("tab=journal&platform=GBA%20Emulator").platform,
  ).toBe("Emulador");
});

it("canonicalizes Switch aliases across saved, loaded and imported console fields", () => {
  const input = {
    ...emptyRecord,
    title: "Switch fixture",
    device: "Nintendo Switch 2",
    platforms: "PC; Nintendo Switch; Switch; Nintendo Switch 2; Switch 2",
    notes: "Nintendo Switch review",
  };
  for (const schema of [recordSchema, journalEntrySchema]) {
    expect(schema.parse(input)).toMatchObject({
      device: "Switch 2",
      platforms: "PC; Switch; Switch 2",
      notes: input.notes,
    });
  }
  const imported = parseWorkbook([
    {
      name: "2025",
      values: [
        ["Juego", "Consola"],
        ["Switch fixture", "Nintendo Switch"],
      ],
    },
  ])[0];
  expect(imported.device).toBe("Switch");
  expect(imported.raw?.consola).toBe("Nintendo Switch");
});
