import { authorized, apiError } from "@/lib/auth";
import { databaseError, HttpError } from "@/lib/api-errors";
import { bodyJson } from "@/lib/validation";
import {
  seriesCommandSchema,
  seriesDeleteSchema,
  seriesListSchema,
  seriesRecordSchema,
} from "@/features/library/series/series";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
function canonical<T>(
  schema: {
    safeParse(value: unknown): { success: true; data: T } | { success: false };
  },
  value: unknown,
): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success)
    throw new HttpError(
      "INVALID_RESPONSE",
      "La respuesta de la serie no es válida.",
      503,
    );
  return parsed.data;
}
function savedRecord(value: unknown) {
  if (!value || typeof value !== "object")
    throw Error("Respuesta de serie inválida.");
  const row = value as Record<string, unknown>;
  return canonical(seriesRecordSchema, {
    id: row.id,
    name: row.name,
    updatedAt: row.updated_at,
    gameIds: row.game_ids,
  });
}
export async function GET() {
  try {
    const { db } = await authorized();
    const { data, error } = await db.rpc("get_game_series");
    if (error) databaseError(error);
    return Response.json(canonical(seriesListSchema, data), { headers });
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    const { db } = await authorized();
    const command = seriesCommandSchema.parse(await bodyJson(request));
    const { data, error } = await db.rpc("save_game_series", {
      series_id: command.id ?? null,
      series_name: command.name,
      game_ids: command.gameIds,
      expected_updated_at: command.updatedAt ?? null,
    });
    if (error) databaseError(error);
    let record;
    try {
      record = savedRecord(data);
    } catch {
      throw new HttpError(
        "INVALID_RESPONSE",
        "La base de datos devolvió una serie no válida.",
        503,
      );
    }
    return Response.json(record, { headers });
  } catch (error) {
    return apiError(error);
  }
}
export async function DELETE(request: Request) {
  try {
    const { db } = await authorized();
    const command = seriesDeleteSchema.parse(await bodyJson(request));
    const { data, error } = await db.rpc("delete_game_series", {
      series_id: command.id,
      expected_updated_at: command.updatedAt,
    });
    if (error) databaseError(error);
    if (data !== true)
      throw new HttpError(
        "INVALID_RESPONSE",
        "La base de datos no confirmó la eliminación.",
        503,
      );
    return Response.json({ deleted: true }, { headers });
  } catch (error) {
    return apiError(error);
  }
}
