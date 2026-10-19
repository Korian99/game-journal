import { authorized, apiError } from "@/lib/auth";
import { bodyJson } from "@/lib/validation";
import { allowedPushEndpoint } from "../../../../supabase/functions/notification-worker/delivery";
import { z } from "zod";
export const dynamic = "force-dynamic";
const switches = z
  .object({
    discounts: z.boolean(),
    targets: z.boolean(),
    releases: z.boolean(),
  })
  .strict();
const headers = { "Cache-Control": "private, no-store" };
export async function GET() {
  try {
    const { db, user } = await authorized();
    const { data, error } = await db
      .from("notification_preferences")
      .select("*")
      .eq("owner_id", user.id)
      .single();
    if (error || !data) throw Error("No se pudieron cargar las preferencias.");
    return Response.json(data, { headers });
  } catch (e) {
    return apiError(e);
  }
}
export async function PUT(request: Request) {
  try {
    const { db, user } = await authorized();
    const input = switches.parse(await bodyJson(request));
    const { data, error } = await db
      .from("notification_preferences")
      .update(input)
      .eq("owner_id", user.id)
      .select("*")
      .single();
    if (error || !data) throw Error("No se pudieron guardar las preferencias.");
    return Response.json(data, { headers });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(request: Request) {
  try {
    const { db, user } = await authorized();
    const { action, endpoint } = z
      .object({
        action: z.enum(["status", "test"]),
        endpoint: z.url().max(2000).refine(allowedPushEndpoint),
      })
      .strict()
      .parse(await bodyJson(request));
    const { data: device, error } = await db
      .from("push_subscriptions")
      .select("id")
      .eq("owner_id", user.id)
      .eq("endpoint", endpoint)
      .maybeSingle();
    if (error) throw Error("No se pudo comprobar este dispositivo.");
    if (action === "status")
      return Response.json({ subscribed: !!device }, { headers });
    if (!device)
      throw Error("Activá las notificaciones en este dispositivo primero.");
    const { data: eventId, error: queueError } = await db.rpc(
      "request_test_notification",
      { endpoint },
    );
    if (queueError) throw Error(queueError.message);
    const { data, error: workerError } = await db.functions.invoke(
      "notification-worker",
      { body: {} },
    );
    return Response.json(
      {
        eventId,
        queued: true,
        sent:
          !workerError &&
          Array.isArray(data?.sentEventIds) &&
          data.sentEventIds.includes(eventId),
      },
      { headers },
    );
  } catch (e) {
    return apiError(e);
  }
}
