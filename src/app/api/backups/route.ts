import { authorized, apiError } from "@/lib/auth";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const { db } = await authorized();
    const download =
      new URL(request.url).searchParams.get("download") === "latest";
    const { data, error } = await db.rpc(
      download ? "read_latest_backup" : "backup_status",
    );
    if (error) throw Error(error.message);
    const headers: Record<string, string> = {
      "Cache-Control": "private, no-store",
    };
    if (download) {
      if (!data)
        return Response.json(
          { error: "No hay un respaldo disponible." },
          { status: 404, headers },
        );
      headers["Content-Disposition"] =
        'attachment; filename="game-journal-backup.json"';
    }
    return Response.json(data, { headers });
  } catch (e) {
    const response = apiError(e);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
}
