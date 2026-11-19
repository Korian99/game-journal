import { z } from "zod";
import { authorized, apiError } from "@/lib/auth";
import { databaseError, HttpError } from "@/lib/api-errors";
import { bodyJson } from "@/lib/validation";
import {
  appearanceGameSchema,
  appearancePaletteSchema,
  appearancePatchSchema,
  appearanceSchema,
} from "@/features/settings/appearance-contracts";

const columns = "mode,palette,playthrough_id,accent";
type AppearanceRow = { mode: string; palette: unknown; playthrough_id: string | null; accent: string | null };
const requestSchema = z.strictObject({
  memberId: z.uuid(),
  patch: appearancePatchSchema,
  expectedGame: appearanceGameSchema.optional(),
}).refine(({ patch, expectedGame }) => !expectedGame || (
  Object.keys(patch).length === 1 && patch.game?.entryId === expectedGame.entryId
));
const initializeSchema = z.strictObject({ memberId: z.uuid(), patch: appearanceSchema });

function respond(memberId: string, row: AppearanceRow | null) {
  const palette = appearancePaletteSchema.safeParse(row?.palette);
  return Response.json({
    memberId,
    preferences: row ? {
      mode: row.mode,
      palette: palette.data ?? null,
      game: row.playthrough_id ? { entryId: row.playthrough_id, color: row.accent } : null,
    } : null,
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function GET() {
  try {
    const { db, user } = await authorized();
    const { data, error } = await db.from("member_appearance").select(columns).eq("member_id", user.id).maybeSingle();
    if (error) databaseError(error);
    return respond(user.id, data);
  } catch (error) {
    return apiError(error);
  }
}

async function save(request: Request, initializeOnly: boolean) {
  try {
    const { db, user } = await authorized();
    const body = await bodyJson(request);
    const { memberId, patch, expectedGame } = initializeOnly
      ? { ...initializeSchema.parse(body), expectedGame: undefined }
      : requestSchema.parse(body);
    if (memberId !== user.id) throw new HttpError("SESSION_CHANGED", "La sesión cambió. Actualizá la página.", 409);
    const { data, error } = await db.rpc("save_member_appearance", {
      patch,
      initialize_only: initializeOnly,
      expected_game: expectedGame ?? null,
    });
    if (error) databaseError(error);
    return respond(user.id, data);
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request) {
  return save(request, true);
}
export async function PATCH(request: Request) {
  return save(request, false);
}
