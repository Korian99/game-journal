import { expect, it, vi } from "vitest";
import { backupFixture, backupOwner, runId } from "./fixtures/backup";
import { sha256 } from "../src/lib/backups/bundle";
import {
  runBackupJob,
  type BackupJob,
  type BackupWorkerDependencies,
} from "../src/lib/backups/worker";
it("resumes a partial bundle with the same file IDs and acknowledges success only after all files verify", async () => {
  const text = JSON.stringify(backupFixture());
  const job: BackupJob = {
    runId: "56565656-5656-4656-8656-565656565656",
    ownerId: backupOwner,
    sourceRunId: runId,
    sourceSha256: sha256(text),
    payloadText: text,
    leaseToken: "67676767-6767-4676-8676-676767676767",
    folderId: "folder_fixture",
    refreshToken: "fake_refresh",
    fileIds: {},
    manifest: null,
  };
  let fail = true;
  const finish = vi.fn(async () => {}),
    reserveIds = vi.fn(async () => ({
      json: "json_id",
      excel: "excel_id",
      manifest: "manifest_id",
    })),
    uploadAndVerify = vi.fn(async (_id: string, artifact: { name: string }) => {
      if (fail && artifact.name.endsWith(".xlsx"))
        throw Error("temporary upload failure");
    });
  const deps: BackupWorkerDependencies = {
    claim: async () => ({ ...job }),
    checkpoint: async (_job, ids, manifest) => {
      job.fileIds = ids;
      job.manifest = manifest;
    },
    finish,
    retention: async () => [],
    pruned: async () => {},
    client: () => ({
      reserveIds,
      uploadAndVerify,
      deleteVerified: async () => {},
    }),
  };
  expect((await runBackupJob(deps)).status).toBe("failed");
  expect(finish).not.toHaveBeenCalledWith(
    expect.anything(),
    "succeeded",
    expect.anything(),
  );
  fail = false;
  finish.mockClear();
  expect((await runBackupJob(deps)).status).toBe("succeeded");
  expect(reserveIds).toHaveBeenCalledTimes(1);
  expect(finish).toHaveBeenCalledWith(
    expect.anything(),
    "succeeded",
    undefined,
  );
  expect(
    uploadAndVerify.mock.calls.filter(([, artifact]) =>
      artifact.name.endsWith(".json"),
    ),
  ).toHaveLength(3);
});
it("refuses a snapshot whose stored checksum changed", async () => {
  const text = JSON.stringify(backupFixture());
  let used = false;
  const result = await runBackupJob({
    claim: async () => ({
      runId,
      ownerId: backupOwner,
      sourceRunId: runId,
      sourceSha256: "0".repeat(64),
      payloadText: text,
      leaseToken: runId,
      folderId: "folder",
      refreshToken: "fake",
      fileIds: {},
      manifest: null,
    }),
    checkpoint: async () => {},
    finish: async () => {},
    retention: async () => [],
    pruned: async () => {},
    client: () => {
      used = true;
      throw Error("must not reach Drive");
    },
  });
  expect(result.status).toBe("failed");
  expect(used).toBe(false);
});
