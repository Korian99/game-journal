import { HttpError } from "../api-errors";
import { z } from "zod";
import {
  buildBackupBundle,
  sha256,
  manifestSchema,
  type BackupArtifact,
  type BackupManifest,
} from "./bundle";
export const fileIdsSchema = z.object({
  json: z.string(),
  excel: z.string(),
  manifest: z.string(),
});
export type FileIds = z.infer<typeof fileIdsSchema>;
export const backupJobSchema = z.object({
  runId: z.uuid(),
  ownerId: z.uuid(),
  sourceRunId: z.uuid(),
  sourceSha256: z.string(),
  payloadText: z.string(),
  leaseToken: z.uuid(),
  folderId: z.string(),
  refreshToken: z.string(),
  fileIds: z.record(z.string(), z.string()),
  manifest: manifestSchema.nullable(),
});
export type BackupJob = z.infer<typeof backupJobSchema>;
export type RetentionRun = { id: string; owner_id: string; file_ids: FileIds };
export interface BackupDriveClient {
  reserveIds: () => Promise<FileIds>;
  uploadAndVerify: (
    id: string,
    artifact: BackupArtifact,
    ownerId: string,
    runId: string,
    folderId: string,
  ) => Promise<void>;
  deleteVerified: (
    id: string,
    ownerId: string,
    runId: string,
    folderId: string,
  ) => Promise<void>;
}
export interface BackupWorkerDependencies {
  claim: () => Promise<BackupJob | null>;
  checkpoint: (
    job: BackupJob,
    ids: FileIds,
    manifest: BackupManifest,
  ) => Promise<void>;
  finish: (
    job: BackupJob,
    outcome: "succeeded" | "failed",
    errorCode?: string,
  ) => Promise<void>;
  client: (job: BackupJob) => BackupDriveClient;
  retention: (ownerId: string) => Promise<RetentionRun[]>;
  pruned: (ownerId: string, runId: string) => Promise<void>;
}
export class DriveBackupError extends HttpError {
  constructor(code: string, message: string) {
    super(
      code,
      message,
      code === "AUTH_REVOKED" ? 401 : code === "INTEGRITY" ? 422 : 503,
    );
  }
}
export async function runBackupJob(deps: BackupWorkerDependencies) {
  const job = await deps.claim();
  if (!job) return { processed: false, status: "idle" as const };
  let client: BackupDriveClient;
  try {
    if (sha256(job.payloadText) !== job.sourceSha256)
      throw new DriveBackupError("INTEGRITY", "Backup checksum mismatch");
    const bundle = await buildBackupBundle(job.payloadText, job.sourceRunId);
    if (
      job.manifest &&
      JSON.stringify(manifestSchema.parse(job.manifest)) !==
        JSON.stringify(bundle.manifest.value)
    )
      throw new DriveBackupError(
        "INTEGRITY",
        "Backup artifact checksum changed",
      );
    client = deps.client(job);
    const ids = Object.keys(job.fileIds).length
      ? fileIdsSchema.parse(job.fileIds)
      : await client.reserveIds();
    await deps.checkpoint(job, ids, bundle.manifest.value);
    for (const kind of ["json", "excel", "manifest"] as const)
      await client.uploadAndVerify(
        ids[kind],
        bundle[kind],
        job.ownerId,
        job.runId,
        job.folderId,
      );
    await deps.finish(job, "succeeded", undefined);
  } catch (error) {
    const code = error instanceof DriveBackupError ? error.code : "TEMPORARY";
    await deps.finish(job, "failed", code);
    return {
      processed: true,
      status: "failed" as const,
      runId: job.runId,
      code,
    };
  }
  let cleanupPending = false;
  try {
    for (const run of await deps.retention(job.ownerId)) {
      for (const id of Object.values(run.file_ids))
        await client.deleteVerified(id, job.ownerId, run.id, job.folderId);
      await deps.pruned(job.ownerId, run.id);
    }
  } catch {
    cleanupPending = true;
  }
  return {
    processed: true,
    status: "succeeded" as const,
    runId: job.runId,
    cleanupPending,
  };
}
