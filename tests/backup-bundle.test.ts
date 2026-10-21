import { expect, it, vi } from "vitest";
import ExcelJS from "exceljs";
import { backupFixture, runId } from "./fixtures/backup";
import {
  buildBackupBundle,
  verifyBackupBundle,
} from "../src/lib/backups/bundle";
it("uses one complete snapshot for JSON and Excel and verifies their exact bytes", async () => {
  const snapshot = backupFixture();
  const bundle = await buildBackupBundle(JSON.stringify(snapshot), runId);
  const restored = verifyBackupBundle(
    bundle.json.bytes,
    bundle.excel.bytes,
    bundle.manifest.bytes,
  );
  expect(restored.sourceTables.playthroughs[0].source_snapshot).toEqual({
    original: "kept",
  });
  expect(restored.records[0].notes).toBe("PRIVATE REVIEW");
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(new Uint8Array(bundle.excel.bytes).buffer);
  expect(book.getWorksheet("Juegos")!.rowCount).toBe(2);
  expect(bundle.manifest.value.files.json.sha256).toHaveLength(64);
});
it("rejects modified backup bytes", async () => {
  const bundle = await buildBackupBundle(
    JSON.stringify(backupFixture()),
    runId,
  );
  const modified = Buffer.from(bundle.json.bytes);
  modified[modified.length - 2] ^= 1;
  expect(() =>
    verifyBackupBundle(modified, bundle.excel.bytes, bundle.manifest.bytes),
  ).toThrow(/checksum/i);
});
it("does not export another owner's rows into the backup", async () => {
  const snapshot = backupFixture();
  snapshot.sourceTables.games[0].owner_id =
    "56565656-5656-4656-8656-565656565656";
  await expect(
    buildBackupBundle(JSON.stringify(snapshot), runId),
  ).rejects.toThrow(/propietario/i);
});
it("retains trashed reviews separately in Excel", async () => {
  const snapshot = backupFixture();
  const record = { ...snapshot.records[0], deleted_at: "2026-10-21T07:00:00Z" };
  const source = {
    ...snapshot,
    records: [],
    trash: [record],
    sourceTables: {
      ...snapshot.sourceTables,
      playthroughs: [
        {
          ...snapshot.sourceTables.playthroughs[0],
          deleted_at: record.deleted_at,
        },
      ],
    },
  };
  const bundle = await buildBackupBundle(JSON.stringify(source), runId);
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(new Uint8Array(bundle.excel.bytes).buffer);
  expect(book.getWorksheet("Papelera")!.getRow(2).values).toContain(
    "PRIVATE REVIEW",
  );
});

it("creates identical artifact bytes when a delayed upload retries", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  try {
    vi.setSystemTime(new Date("2026-10-21T10:00:00Z"));
    const first = await buildBackupBundle(
      JSON.stringify(backupFixture()),
      runId,
    );
    vi.setSystemTime(new Date("2026-10-22T12:00:00Z"));
    const next = await buildBackupBundle(
      JSON.stringify(backupFixture()),
      runId,
    );
    expect(next.excel.sha256).toBe(first.excel.sha256);
    expect(next.manifest.sha256).toBe(first.manifest.sha256);
  } finally {
    vi.useRealTimers();
  }
});
