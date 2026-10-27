import { authorized, apiError } from "@/lib/auth";
import { databaseError, HttpError } from "@/lib/api-errors";
import { bodyJson } from "@/lib/validation";
import { journalEntrySchema } from "@/lib/contracts";
import {
  dataCheckCommandSchema,
  dataCheckStateSchema,
  dataChecks,
} from "@/lib/journal/data-checks";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
function canonicalState(value: unknown) {
  const parsed = dataCheckStateSchema.safeParse(value);
  if (!parsed.success)
    throw new HttpError(
      "INVALID_RESPONSE",
      "No se pudieron validar las preferencias recibidas.",
      503,
    );
  return parsed.data;
}
export async function GET() {
  try {
    const { db } = await authorized();
    const { data, error } = await db.rpc("get_data_check_state");
    if (error) databaseError(error);
    return Response.json(canonicalState(data), { headers });
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    const { db } = await authorized();
    const command = dataCheckCommandSchema.parse(await bodyJson(request));
    if (command.action === "dismiss") {
      const { data, error } = await db.rpc("get_data_check_entry", {
        entry: command.entryId,
      });
      if (error) databaseError(error);
      if (!data)
        throw new HttpError(
          "NOT_FOUND",
          "La partida ya no está disponible.",
          404,
        );
      const entry = journalEntrySchema.parse(data);
      const finding = dataChecks([entry]).find((f) => f.kind === command.kind);
      if (
        !finding ||
        JSON.stringify(finding.values) !== JSON.stringify(command.values)
      )
        throw new HttpError(
          "CONFLICT",
          "Los datos cambiaron. Actualiza los juegos antes de ocultar este aviso.",
          409,
        );
    }
    const { data, error } = await db.rpc("apply_data_check_command", {
      command,
    });
    if (error) databaseError(error);
    return Response.json(canonicalState(data), { headers });
  } catch (error) {
    return apiError(error);
  }
}
