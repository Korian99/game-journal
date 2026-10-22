import fs from "node:fs";
import { disposableDatabase } from "../tests/support/disposable-db.mjs";
import { backupFixture, backupOwner, runId } from "../tests/fixtures/backup";
import {
  parseBackupSnapshot,
  verifyBackupBundle,
  sha256,
  type BackupSnapshot,
} from "../src/lib/backups/bundle";
import { restoreSql } from "../src/lib/backups/restore";
import { runBackupJob, type BackupJob } from "../src/lib/backups/worker";
// No connection-string option is supported: these tests always create isolated, owned Docker containers.
await disposableDatabase(async (sql: (input: string) => string) => {
  for (const name of fs
    .readdirSync("tests")
    .filter(
      (name) =>
        name.endsWith(".integration.sql") ||
        name === "explicit-grants.verify.sql",
    )
    .sort()) {
    const result = sql(fs.readFileSync("tests/" + name, "utf8"));
    if (name.endsWith(".verify.sql") && !result.includes("PASS"))
      throw Error(result);
    console.log("PASS SQL " + name);
  }
});
await disposableDatabase(async (sql: (input: string) => string) => {
  const snapshotData: BackupSnapshot = parseBackupSnapshot(
    JSON.stringify(backupFixture()),
  );
  snapshotData.version = 5;
  snapshotData.sourceTables.scoring_guide = [
    {
      owner_id: backupOwner,
      score_threshold: 95,
      meaning: "RECOVERED PERSONAL SCALE",
    },
  ];
  const deletedId = "56565656-1111-4111-8111-111111111111",
    deletedAt = "2026-10-21T06:00:00Z";
  snapshotData.trash.push({
    ...snapshotData.records[0],
    id: deletedId,
    notes: "PRIVATE TRASH",
    deleted_at: deletedAt,
  });
  snapshotData.sourceTables.playthroughs.push({
    ...snapshotData.sourceTables.playthroughs[0],
    id: deletedId,
    data: { status: "completed", notes: "PRIVATE TRASH" },
    deleted_at: deletedAt,
  });
  const targetOwner = "78787878-7878-4878-8878-787878787878",
    text = JSON.stringify(snapshotData),
    files = new Map<string, Uint8Array>();
  const job: BackupJob = {
    runId: "56565656-5656-4656-8656-565656565656",
    ownerId: backupOwner,
    sourceRunId: runId,
    sourceSha256: sha256(text),
    payloadText: text,
    leaseToken: "67676767-6767-4676-8676-676767676767",
    folderId: "fixture_folder",
    refreshToken: "fixture_refresh",
    fileIds: {},
    manifest: null,
  };
  const result = await runBackupJob({
    claim: async () => job,
    checkpoint: async (_job, ids, manifest) => {
      job.fileIds = ids;
      job.manifest = manifest;
    },
    finish: async () => {},
    retention: async () => [],
    pruned: async () => {},
    client: () => ({
      reserveIds: async () => ({
        json: "json",
        excel: "excel",
        manifest: "manifest",
      }),
      uploadAndVerify: async (id, artifact) => {
        files.set(id, artifact.bytes);
      },
      deleteVerified: async () => {},
    }),
  });
  if (result.status !== "succeeded")
    throw Error("Mocked external upload failed");
  const snapshot = verifyBackupBundle(
    files.get("json")!,
    files.get("excel")!,
    files.get("manifest")!,
  );
  const recovery = restoreSql(snapshot, targetOwner);
  sql(
    "insert into auth.users(id,email) values('" +
      targetOwner +
      "','recovery@example.invalid');insert into public.members(id,display_name) values('" +
      targetOwner +
      "','Disposable recovery');",
  );
  sql(recovery.sql);
  const check = sql(
    "select data->>'notes' from public.playthroughs where owner_id='" +
      targetOwner +
      "';",
  );
  if (!check.includes("PRIVATE REVIEW") || !check.includes("PRIVATE TRASH"))
    throw Error("Recovery lost review text");
  const removed = sql(
    "select count(*) from public.playthroughs where deleted_at is not null;",
  );
  if (removed.trim() !== "1") throw Error("Recovery lost trash metadata");
  const restoredGuide = sql(
    "select meaning from public.scoring_guide where owner_id='" +
      targetOwner +
      "' and score_threshold=95;",
  );
  if (restoredGuide.trim() !== "RECOVERED PERSONAL SCALE")
    throw Error("Recovery lost personal scoring guide");
  const privacy = sql("select count(*) from public.shared_entries;");
  if (privacy.trim() !== "0")
    throw Error("Recovery unexpectedly restored sharing");
  console.log(
    "PASS JSON + Excel + manifest upload and restore into an empty disposable database with explicit owner mapping",
  );
});
