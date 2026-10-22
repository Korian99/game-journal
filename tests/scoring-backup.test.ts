import { expect, it } from "vitest";
import ExcelJS from "exceljs";
import { backupFixture, backupOwner } from "./fixtures/backup";
import {
  parseBackupSnapshot,
  buildBackupBundle,
} from "../src/lib/backups/bundle";
import { restoreSql } from "../src/lib/backups/restore";
import { excelExport } from "../src/lib/export";
const row = {
  owner_id: backupOwner,
  score_threshold: 95,
  meaning: "Mi escala personal",
};
function fixture() {
  const value = backupFixture();
  return {
    ...value,
    version: 5,
    sourceTables: { ...value.sourceTables, scoring_guide: [row] },
  };
}
it("keeps personal meanings in the snapshot and maps ownership on recovery", () => {
  const value = parseBackupSnapshot(JSON.stringify(fixture()));
  const recovery = restoreSql(value, "78787878-7878-4878-8878-787878787878");
  expect(recovery.sql).toContain("insert into public.scoring_guide");
  expect(recovery.sql).toContain("Mi escala personal");
  expect(recovery.summary.scoringGuide).toBe(1);
});
it("rejects another owner's scoring meanings", () => {
  const value = fixture();
  value.sourceTables.scoring_guide[0] = {
    ...row,
    owner_id: "78787878-7878-4878-8878-787878787878",
  };
  expect(() => parseBackupSnapshot(JSON.stringify(value))).toThrow(
    "otro propietario",
  );
});
it("still restores older snapshots with no scoring guide", () => {
  expect(
    restoreSql(backupFixture(), "78787878-7878-4878-8878-787878787878").summary
      .scoringGuide,
  ).toBe(0);
});
it("includes an informative guide worksheet in Excel exports", async () => {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(
    new Uint8Array(
      await excelExport({
        records: [],
        offers: [],
        priceHistory: [],
        exportedAt: new Date().toISOString(),
        scoringGuide: [row],
      }),
    ).buffer,
  );
  expect(book.getWorksheet("Guía de reseñas")?.getCell("B2").value).toBe(
    "Mi escala personal",
  );
});
it("includes the guide in the external backup Excel", async () => {
  const bundle = await buildBackupBundle(
    JSON.stringify(fixture()),
    "45454545-4545-4545-8545-454545454545",
  );
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(new Uint8Array(bundle.excel.bytes).buffer);
  expect(book.getWorksheet("Guía de reseñas")?.getCell("A2").value).toBe(95);
});
