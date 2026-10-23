import { authorized, apiError } from "@/lib/auth";
import { databaseError } from "@/lib/api-errors";
import {
  notificationQuery,
  notificationPage,
} from "@/lib/notifications/history";
import { bodyJson } from "@/lib/validation";
import { z } from "zod";
export async function GET(request: Request) {
  try {
    const { db, user } = await authorized(),
      query = notificationQuery(new URL(request.url).searchParams);
    let list = db
      .from("notifications")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(26);
    if (query.id) list = list.eq("id", query.id);
    if (query.read === "unread") list = list.is("read_at", null);
    if (query.kind) list = list.eq("kind", query.kind);
    if (query.cursor)
      list = list.or(
        "created_at.lt." +
          query.cursor.at +
          ",and(created_at.eq." +
          query.cursor.at +
          ",id.lt." +
          query.cursor.id +
          ")",
      );
    const [result, count] = await Promise.all([
      list,
      db
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", user.id)
        .is("read_at", null),
    ]);
    if (result.error) databaseError(result.error);
    if (count.error) databaseError(count.error);
    return Response.json(
      notificationPage(
        result.data ?? [],
        count.count ?? 0,
        new Date().toISOString(),
      ),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
export async function PATCH(request: Request) {
  try {
    const { db, user } = await authorized(),
      input = z
        .union([
          z.object({ ids: z.array(z.uuid()).min(1).max(100) }),
          z.object({ allBefore: z.iso.datetime({ offset: true }) }),
        ])
        .parse(await bodyJson(request));
    let update = db
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("owner_id", user.id)
      .is("read_at", null);
    if ("ids" in input) update = update.in("id", input.ids);
    else update = update.lte("created_at", input.allBefore);
    const { error } = await update;
    if (error) databaseError(error);
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
