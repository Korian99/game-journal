import { authorized, apiError } from "@/lib/auth";
import { HttpError, databaseError } from "@/lib/api-errors";
import { bodyJson } from "@/lib/validation";
import { notebookSchema } from "@/lib/notebook";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { db, user } = await authorized();
    const { data, error } = await db
      .from("notebooks")
      .select("content")
      .eq("owner_id", user.id)
      .maybeSingle();
    if (error) databaseError(error);

    const state = notebookSchema.safeParse(data ?? { content: "" });
    if (!state.success)
      throw new HttpError(
        "TEMPORARY",
        "No se pudo consultar el cuaderno. Volvé a intentarlo.",
        503,
      );
    return Response.json(state.data, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const { db, user } = await authorized();
    const input = notebookSchema.parse(await bodyJson(request));
    const { data, error } = await db
      .from("notebooks")
      .upsert(
        { owner_id: user.id, content: input.content },
        { onConflict: "owner_id" },
      )
      .select("content")
      .single();
    if (error) databaseError(error);

    const saved = notebookSchema.safeParse(data);
    if (!saved.success)
      throw new HttpError(
        "TEMPORARY",
        "No se pudo confirmar el guardado del cuaderno. Volvé a intentarlo.",
        503,
      );
    return Response.json(saved.data, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}
