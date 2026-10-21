import { databaseError } from "@/lib/api-errors";
import { authorized, apiError } from "@/lib/auth";
import { parseWorkbook, makeImportPlan } from "@/lib/domain";
import { bodyJson } from "@/lib/validation";
import { z } from "zod";
export async function POST(request: Request) {
  try {
    const { db, user } = await authorized();
    const body = await bodyJson(request);
    if (body.action === "apply") {
      const input = z
        .object({
          batchId: z.uuid(),
          resolutions: z.record(
            z.string(),
            z.record(z.string(), z.enum(["sheet", "app", "skip"])),
          ),
        })
        .parse(body);
      const { data, error } = await db.rpc("apply_import", {
        batch_id: input.batchId,
        resolutions: input.resolutions,
      });
      if (error) databaseError(error);
      return Response.json({ count: data });
    }
    const input = z
      .object({
        token: z.string().min(10).max(10000),
        spreadsheetId: z.string().regex(/^[a-zA-Z0-9_-]+$/),
      })
      .parse(body);
    const url =
      "https://sheets.googleapis.com/v4/spreadsheets/" +
      input.spreadsheetId +
      "?includeGridData=true&fields=sheets(properties(title),data(rowData(values(effectiveValue))))";
    const response = await fetch(url, {
      headers: { Authorization: "Bearer " + input.token },
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok)
      throw Error("Google no permitió leer la planilla. Volvé a conectar.");
    const cell = z.object({
      effectiveValue: z
        .object({
          stringValue: z.string().optional(),
          numberValue: z.number().optional(),
          boolValue: z.boolean().optional(),
        })
        .optional(),
    });
    const workbook = z
      .object({
        sheets: z.array(
          z.object({
            properties: z.object({ title: z.string() }),
            data: z
              .array(
                z.object({
                  rowData: z
                    .array(z.object({ values: z.array(cell).optional() }))
                    .optional(),
                }),
              )
              .optional(),
          }),
        ),
      })
      .parse(await response.json());
    const tabs = workbook.sheets
      .filter((s) =>
        ["Tablas", "2025", "2026", "<2025"].includes(s.properties.title),
      )
      .map((s) => ({
        name: s.properties.title,
        values: (s.data?.[0]?.rowData ?? [])
          .slice(0, 5000)
          .map((r) =>
            (r.values ?? []).map(
              (c) =>
                c.effectiveValue?.stringValue ??
                c.effectiveValue?.numberValue ??
                c.effectiveValue?.boolValue ??
                "",
            ),
          ),
      }));
    const incoming = parseWorkbook(tabs);
    if (incoming.length > 5000) throw Error("Importación demasiado grande");
    const { data: existing, error } = await db.rpc("list_records_with_trash");
    if (error) databaseError(error);
    const plan = makeImportPlan(incoming, existing ?? []);
    const { data: batch, error: saveError } = await db
      .from("imports")
      .insert({
        owner_id: user.id,
        spreadsheet_id: input.spreadsheetId,
        source: tabs,
        plan,
      })
      .select("id")
      .single();
    if (saveError) databaseError(saveError);
    return Response.json({ batchId: batch.id, plan });
  } catch (e) {
    return apiError(e);
  }
}
