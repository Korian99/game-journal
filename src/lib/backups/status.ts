import { z } from "zod";
const run = z.object({
  id: z.string(),
  status: z.string(),
  verified_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  file_ids: z.record(z.string(), z.string()),
  error_code: z.string().nullable().optional(),
  manifest: z.record(z.string(), z.unknown()).nullable().optional(),
});
export const driveStatusSchema = z.object({
  configured: z.boolean().default(true),
  connected: z.boolean(),
  state: z.string(),
  folderId: z.string().nullable(),
  errorCode: z.string().nullable(),
  recoveryVerifiedAt: z.string().nullable(),
  latest: run.nullable(),
  lastSuccess: run.nullable(),
  checkedAt: z.string(),
});
export type DriveBackupStatus = z.infer<typeof driveStatusSchema>;
export function externalBackupWarning(
  status: DriveBackupStatus,
  now = Date.now(),
) {
  if (!status.connected) return "";
  if (status.state === "needs_reconnect")
    return "Reconectá Google Drive para continuar las copias.";
  if (status.errorCode)
    return "La última copia en Google Drive falló. Las copias anteriores se conservan.";
  if (!status.lastSuccess)
    return "Todavía no hay una copia verificada en Google Drive.";
  const stamp = Date.parse(status.lastSuccess.verified_at ?? "");
  return !Number.isFinite(stamp) || now - stamp >= 48 * 3600000
    ? "La última copia en Google Drive tiene más de 48 horas."
    : "";
}
