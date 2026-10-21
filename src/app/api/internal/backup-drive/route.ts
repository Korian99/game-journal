import { z } from "zod";
import { timingSafeEqual } from "node:crypto";
import {
  performDriveBackup,
  driveBackupConfigured,
} from "@/lib/backups/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function POST(request: Request) {
  const secret = process.env.BACKUP_WORKER_SECRET;
  if (!secret || !driveBackupConfigured())
    return Response.json(
      { error: "Servicio no configurado.", code: "CONFIGURATION" },
      { status: 503 },
    );
  const given = Buffer.from(request.headers.get("authorization") ?? ""),
    expected = Buffer.from("Bearer " + secret);
  if (given.length !== expected.length || !timingSafeEqual(given, expected))
    return Response.json(
      { error: "No autorizado.", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  try {
    const raw = await request.text();
    const input = z
      .object({ ownerId: z.uuid().optional() })
      .parse(raw ? JSON.parse(raw) : {});
    return Response.json(await performDriveBackup(input.ownerId ?? null));
  } catch {
    return Response.json(
      { error: "No se pudo completar el respaldo.", code: "TEMPORARY" },
      { status: 503 },
    );
  }
}
