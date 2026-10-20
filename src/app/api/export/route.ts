import { authorized, apiError } from "@/lib/auth";
import { csvExport, excelExport, type ExportData } from "@/lib/export";
import { formatDateTime } from "@/lib/journal/view-config";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type DB = Awaited<ReturnType<typeof authorized>>["db"];
async function readAll(
  db: DB,
  table: "offers" | "price_history",
  owner: string,
) {
  const rows: Record<string, any>[] = [];
  let after: string | undefined;
  for (;;) {
    let query = db
      .from(table)
      .select("*")
      .eq("owner_id", owner)
      .order("id", { ascending: true })
      .limit(500);
    if (after) query = query.gt("id", after);
    const { data, error } = await query;
    if (error) throw Error(error.message);
    if (!data?.length) return rows;
    const next = data[data.length - 1].id;
    if (typeof next !== "string" || (after && next <= after))
      throw Error("No se pudo completar la exportación.");
    rows.push(...data);
    after = next;
  }
}
export async function GET(request: Request) {
  try {
    const { db, user } = await authorized();
    const { data: records, error } = await db.rpc("list_records");
    if (error) throw Error(error.message);
    const [offers, priceHistory] = await Promise.all([
      readAll(db, "offers", user.id),
      readAll(db, "price_history", user.id),
    ]);
    const exportedAt = new Date().toISOString();
    const data = {
      records: records ?? [],
      offers,
      priceHistory,
      exportedAt,
    } as ExportData;
    const format = new URL(request.url).searchParams.get("format");
    const stamp = formatDateTime(exportedAt).replace(
      /^(\d{2})\/(\d{2})\/(\d{4}), (\d{2}):(\d{2})$/,
      "$3-$2-$1-$4$5",
    );
    const headers = {
      "Cache-Control": "private, no-store",
      "Content-Disposition":
        'attachment; filename="game-journal-' +
        stamp +
        "." +
        (format === "xlsx" ? "xlsx" : format === "csv" ? "csv" : "json") +
        '"',
    };
    if (format === "xlsx")
      return new Response(await excelExport(data), {
        headers: {
          ...headers,
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      });
    if (format === "csv")
      return new Response(csvExport(data), {
        headers: { ...headers, "Content-Type": "text/csv; charset=utf-8" },
      });
    return Response.json({ version: 2, ...data }, { headers });
  } catch (e) {
    return apiError(e);
  }
}
