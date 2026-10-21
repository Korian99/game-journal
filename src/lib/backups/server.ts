import "server-only";
import { z } from "zod";
import { adminClient } from "../supabase/admin";
import { HttpError } from "../api-errors";
import { GoogleDriveBackupClient, googleOAuthClient } from "./drive";
import {
  backupJobSchema,
  fileIdsSchema,
  runBackupJob,
  type BackupJob,
} from "./worker";
export function driveBackupConfigured() {
  return !!(
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.GOOGLE_BACKUP_CLIENT_ID &&
    process.env.GOOGLE_BACKUP_CLIENT_SECRET &&
    process.env.NEXT_PUBLIC_APP_URL
  );
}
export async function driveAdmin<T>(
  action: string,
  ownerId: string | null,
  payload: Record<string, unknown>,
  schema: z.ZodType<T>,
): Promise<T> {
  const { data, error } = await adminClient().rpc("drive_backup_admin", {
    action,
    member_id: ownerId,
    payload,
  });
  if (error)
    throw new HttpError(
      "TEMPORARY",
      "No se pudo completar la operación del respaldo.",
      503,
    );
  return schema.parse(data);
}
export const okSchema = z.object({ ok: z.boolean() });
export function driveClient(refreshToken: string) {
  const oauth = googleOAuthClient();
  oauth.setCredentials({ refresh_token: refreshToken });
  return new GoogleDriveBackupClient(oauth);
}
const retentionSchema = z.array(
  z.object({ id: z.string(), owner_id: z.string(), file_ids: fileIdsSchema }),
);
export async function performDriveBackup(ownerId: string | null = null) {
  return runBackupJob({
    claim: () => driveAdmin("claim", ownerId, {}, backupJobSchema.nullable()),
    checkpoint: async (job, ids, manifest) => {
      await driveAdmin(
        "checkpoint",
        null,
        {
          runId: job.runId,
          leaseToken: job.leaseToken,
          fileIds: ids,
          manifest,
        },
        okSchema,
      );
    },
    finish: async (job, outcome, errorCode) => {
      await driveAdmin(
        "finish",
        null,
        { runId: job.runId, leaseToken: job.leaseToken, outcome, errorCode },
        okSchema,
      );
    },
    client: (job: BackupJob) => {
      const client = driveClient(job.refreshToken);
      let verified = false;
      return {
        reserveIds: () => client.reserveIds(),
        uploadAndVerify: async (
          ...args: Parameters<typeof client.uploadAndVerify>
        ) => {
          if (!verified) {
            await client.verifyFolder(job.folderId, job.ownerId);
            verified = true;
          }
          return client.uploadAndVerify(...args);
        },
        deleteVerified: (...args: Parameters<typeof client.deleteVerified>) =>
          client.deleteVerified(...args),
      };
    },
    retention: (owner) => driveAdmin("retention", owner, {}, retentionSchema),
    pruned: async (owner, runId) => {
      await driveAdmin("pruned", owner, { runId }, okSchema);
    },
  });
}
