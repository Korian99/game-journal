import { authorized, apiError } from "@/lib/auth";
export async function GET(request: Request) {
  try {
    const { db } = await authorized();
    const { data: records, error } = await db.rpc("list_records");
    if (error) throw Error(error.message);
    const { data: offers } = await db.from("offers").select("*");
    if (new URL(request.url).searchParams.get("format") !== "csv")
      return Response.json(
        { version: 1, exportedAt: new Date().toISOString(), records, offers },
        {
          headers: {
            "Content-Disposition": 'attachment; filename="game-journal.json"',
            "Cache-Control": "private, no-store",
          },
        },
      );
    const fields = [
      "title",
      "year",
      "platforms",
      "period",
      "device",
      "status",
      "hours",
      "rating",
      "memorability",
      "impression",
      "notes",
    ];
    const cell = (x: unknown) => {
      const text = String(x ?? "");
      return (
        '"' +
        (/^[=+\-@\t\r]/.test(text) ? "'" : "") +
        text.replaceAll('"', '""') +
        '"'
      );
    };
    return new Response(
      "\uFEFF" +
        [fields, ...(records ?? []).map((r: any) => fields.map((f) => r[f]))]
          .map((r) => r.map(cell).join(","))
          .join("\r\n"),
      {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="game-journal.csv"',
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (e) {
    return apiError(e);
  }
}
