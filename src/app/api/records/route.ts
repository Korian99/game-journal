import { authorized, apiError } from "@/lib/auth";
import { bodyJson, recordSchema } from "@/lib/validation";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const { db, member } = await authorized();
    const { data, error } = await db.rpc("list_records");
    if (error) throw Error(error.message);
    const { data: offers } = await db.from("offers").select("*");
    return Response.json(
      { records: data ?? [], offers: offers ?? [], member },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(request: Request) {
  try {
    const { db } = await authorized();
    const input = recordSchema.parse(await bodyJson(request));
    const { data, error } = await db.rpc("save_record", {
      input,
      record_id: input.id ?? null,
      expected: input.updated_at ?? null,
    });
    if (error) throw Error(error.message);
    return Response.json(data);
  } catch (e) {
    return apiError(e);
  }
}
export async function DELETE(request: Request) {
  try {
    const { db } = await authorized();
    const { id } = await bodyJson(request);
    if (typeof id !== "string") throw Error("Entrada inválida");
    const { error } = await db.from("playthroughs").delete().eq("id", id);
    if (error) throw Error(error.message);
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
