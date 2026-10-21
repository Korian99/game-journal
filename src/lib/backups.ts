import { z } from "zod";
export const backupRunSchema = z.object({
  id: z.string(),
  status: z.string(),
  started_at: z.string().optional(),
  completed_at: z.string().nullable().optional(),
  record_count: z.number().optional(),
  byte_count: z.number().optional(),
});
export const backupStatusSchema = z.object({
  latest: backupRunSchema.nullable(),
  lastSuccess: backupRunSchema.nullable(),
  checkedAt: z.string().refine((value) => Number.isFinite(Date.parse(value))),
});
export type BackupRun = {
  id: string;
  status: string;
  started_at?: string;
  completed_at?: string | null;
  record_count?: number;
  byte_count?: number;
};
export type BackupStatus = {
  latest: BackupRun | null;
  lastSuccess: BackupRun | null;
  checkedAt: string;
};
export function backupWarning(
  status: BackupStatus | null,
  now: number,
): string {
  if (!status || !Number.isFinite(Date.parse(status.checkedAt)))
    return "No se pudo verificar el respaldo automático.";
  const run = status.lastSuccess;
  if (!run) return "Todavía no hay un respaldo automático disponible.";
  const completed = Date.parse(run.completed_at ?? "");
  if (!Number.isFinite(completed) || completed > now + 300_000)
    return "No se pudo verificar la fecha del último respaldo.";
  if (now - completed >= 48 * 3600_000)
    return "El último respaldo tiene más de 48 horas. Descargá una copia de tus datos.";
  if (status.latest?.status === "failed")
    return "El último respaldo automático falló. La copia anterior sigue disponible.";
  if (
    status.latest?.status === "running" &&
    now - Date.parse(status.latest.started_at ?? "") >= 30 * 60_000
  )
    return "El último respaldo automático no se completó. Revisá su estado.";
  return "";
}
