import { authorized, apiError } from "@/lib/auth";
import { bodyJson } from "@/lib/validation";
import { databaseError } from "@/lib/api-errors";
import { z } from "zod";
export const dynamic = "force-dynamic";
const itemSchema = z.object({
  id: z.uuid(),
  expected: z.string().nullable().optional(),
});
export async function GET() {
  try {
    const { db } = await authorized();
    const { data, error } = await db.rpc("list_trash");
    if (error) databaseError(error);
    return Response.json(data ?? [], {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}
export async function PATCH(request: Request) {
  try {
    const { db } = await authorized();
    const input = itemSchema.parse(await bodyJson(request));
    const { data, error } = await db.rpc("restore_record", {
      record_id: input.id,
      expected: input.expected ?? null,
    });
    if (error) databaseError(error);
    return Response.json(data);
  } catch (error) {
    return apiError(error);
  }
}
export async function DELETE(request: Request) {
  try {
    const { db } = await authorized();
    const input = z
      .object({
        items: z.array(itemSchema).min(1).max(5000),
        confirmed: z.literal(true),
      })
      .parse(await bodyJson(request));
    // One transaction: a changed item must not leave a partially emptied trash.
    const { data, error } = await db.rpc("purge_trash_items", {
      items: input.items,
    });
    if (error) databaseError(error);
    return Response.json(data);
  } catch (error) {
    return apiError(error);
  }
}
