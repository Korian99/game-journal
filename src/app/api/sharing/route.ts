import { authorized, apiError } from "@/lib/auth";
import { bodyJson } from "@/lib/validation";
import { z } from "zod";
export async function GET() {
  try {
    const { db, user } = await authorized();
    const { data: shared, error } = await db.rpc("read_shared");
    if (error) throw Error(error.message);
    const { data: members } = await db
      .from("members")
      .select("id,display_name")
      .neq("id", user.id)
      .eq("active", true);
    const { data: grants } = await db
      .from("shared_entries")
      .select("*")
      .eq("owner_id", user.id);
    return Response.json({
      shared: shared ?? [],
      members: members ?? [],
      grants: grants ?? [],
    });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(request: Request) {
  try {
    const { db, user } = await authorized();
    const body = z
      .object({ entry_id: z.uuid(), recipient_id: z.uuid() })
      .parse(await bodyJson(request));
    const { error } = await db
      .from("shared_entries")
      .insert({ ...body, owner_id: user.id });
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
    const { error } = await db.from("shared_entries").delete().eq("id", id);
    if (error) throw Error(error.message);
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
