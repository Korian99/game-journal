import { authorized, apiError } from "@/lib/auth";
import { bodyJson } from "@/lib/validation";
import { z } from "zod";
import { allowedPushEndpoint } from "../../../../supabase/functions/notification-worker/delivery";
export async function GET() {
  try {
    const { db } = await authorized();
    const { data, error } = await db
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw Error(error.message);
    return Response.json(data, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(request: Request) {
  try {
    const { db, user } = await authorized();
    const subscription = z
      .object({
        endpoint: z.url().max(2000).refine(allowedPushEndpoint),
        keys: z.object({ p256dh: z.string(), auth: z.string() }),
      })
      .parse(await bodyJson(request));
    if (!subscription.endpoint.startsWith("https://"))
      throw Error("Endpoint inválido");
    const { error } = await db
      .from("push_subscriptions")
      .upsert(
        { owner_id: user.id, endpoint: subscription.endpoint, subscription },
        { onConflict: "endpoint" },
      );
    if (error) throw Error(error.message);
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
export async function DELETE(request: Request) {
  try {
    const { db } = await authorized();
    const { endpoint } = await bodyJson(request);
    const { error } = await db
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", endpoint);
    if (error) throw Error(error.message);
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}

export async function PATCH() {
  try {
    const { db, user } = await authorized();
    const { error } = await db
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("owner_id", user.id)
      .is("read_at", null);
    if (error) throw Error(error.message);
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
