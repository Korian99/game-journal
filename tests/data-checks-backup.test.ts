import { expect, it } from "vitest";
import { backupFixture, backupOwner, recordId } from "./fixtures/backup";
import { parseBackupSnapshot } from "../src/lib/backups/bundle";
import { restoreSql } from "../src/lib/backups/restore";
const target = "78787878-7878-4878-8878-787878787878";
const fixture = () => {
  const old = backupFixture();
  return {
    ...old,
    version: 6,
    sourceTables: {
      ...old.sourceTables,
      data_check_preferences: [
        { owner_id: backupOwner, review: true, console: false, hours: true },
      ],
      data_check_dismissals: [
        {
          owner_id: backupOwner,
          entry_id: recordId,
          kind: "missing-review",
          field_values: ["completed", null],
        },
      ],
    },
  };
};
it("preserves new check state and remaps its owner on restore", () => {
  const snapshot = parseBackupSnapshot(JSON.stringify(fixture()));
  const restored = restoreSql(snapshot, target);
  expect(restored.sql).toContain("insert into public.data_check_preferences");
  expect(restored.sql).toContain("insert into public.data_check_dismissals");
  expect(restored.sql).toContain(
    '"owner_id":"' + target + '","entry_id":"' + recordId + '"',
  );
  expect(restored.summary).toMatchObject({
    dataCheckPreferences: 1,
    dataCheckDismissals: 1,
  });
});
it.each([3, 4, 5])(
  "still accepts older format %s without check state",
  (version) => {
    const snapshot = parseBackupSnapshot(
      JSON.stringify({ ...backupFixture(), version }),
    );
    expect(snapshot.sourceTables.data_check_dismissals).toEqual([]);
    expect(restoreSql(snapshot, target).summary.dataCheckDismissals).toBe(0);
  },
);
it("requires complete state fields in new snapshots and rejects foreign owners or missing playthroughs", () => {
  const value = fixture();
  const missing = {
    ...value,
    sourceTables: { ...backupFixture().sourceTables },
  };
  expect(() => parseBackupSnapshot(JSON.stringify(missing))).toThrow();
  value.sourceTables.data_check_dismissals[0].owner_id = target;
  expect(() => parseBackupSnapshot(JSON.stringify(value))).toThrow(
    "otro propietario",
  );
  const orphan = fixture();
  orphan.sourceTables.data_check_dismissals[0].entry_id = target;
  expect(() => parseBackupSnapshot(JSON.stringify(orphan))).toThrow(
    "relaciones incompletas",
  );
});
