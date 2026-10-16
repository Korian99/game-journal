import { authorized, apiError } from "@/lib/auth";
import { parseStoreUrl } from "@/lib/domain";
import { bodyJson } from "@/lib/validation";
import { z } from "zod";
export async function POST(request: Request) {
  try {
    const { db, user } = await authorized();
    const input = z
      .object({ gameId: z.uuid(), url: z.string().max(2000) })
      .parse(await bodyJson(request));
    const item = parseStoreUrl(input.url);
    const { data, error } = await db
      .from("offers")
      .insert({
        owner_id: user.id,
        game_id: input.gameId,
        url: item.url,
        store: item.store,
        product: item.product,
        region: item.region,
      })
      .select()
      .single();
    if (error) throw Error(error.message);
    return Response.json(data);
  } catch (e) {
    return apiError(e);
  }
}
export async function PATCH(request: Request) {
  try {
    const { db } = await authorized();
    const { id, ...input } = z
      .object({
        id: z.uuid(),
        watched: z.boolean(),
        target_price: z.number().nonnegative().nullable(),
      })
      .parse(await bodyJson(request));
    const { error } = await db.from("offers").update(input).eq("id", id);
    if (error) throw Error(error.message);
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
export async function DELETE(request: Request) {
  try {
    const { db } = await authorized();
    const { id } = z.object({ id: z.uuid() }).parse(await bodyJson(request));
    const { error } = await db.from("offers").delete().eq("id", id);
    if (error) throw Error(error.message);
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
export async function GET(request: Request) {
  try {
    const { db } = await authorized();
    const id = new URL(request.url).searchParams.get("id");
    const { data, error } = await db
      .from("price_history")
      .select("*")
      .eq("offer_id", id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw Error(error.message);
    return Response.json(data);
  } catch (e) {
    return apiError(e);
  }
}
