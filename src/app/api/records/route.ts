import { authorized, apiError } from "@/lib/auth";
import { z } from "zod";
import { bodyJson, recordSchema } from "@/lib/validation";
import { findDuplicates, normalizedTitle } from "@/lib/journal/duplicates";
import { recordsResponseSchema } from "@/lib/contracts";
import { databaseError } from "@/lib/api-errors";
import { parseStoreUrl } from "@/lib/domain";
export const dynamic = "force-dynamic";
export async function GET(request?: Request) {
  try {
    const { db, member } = await authorized();
    const { data, error } = await db.rpc("list_records");
    if (error) databaseError(error);
    let offers;
    if (
      !request ||
      new URL(request.url).searchParams.get("includeOffers") !== "false"
    ) {
      const result = await db.from("offers").select("*");
      if (result.error) databaseError(result.error);
      offers = result.data ?? [];
    }
    return Response.json(
      {
        records: data ?? [],
        ...(offers === undefined ? {} : { offers }),
        member,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(request: Request) {
  try {
    const { db } = await authorized();
    const body: unknown = await bodyJson(request);
    const input = recordSchema.parse(body);
    const decision = z
      .object({ allowDuplicate: z.boolean().optional() })
      .parse(body);
    const existing = await db.rpc("list_records");
    if (existing.error) databaseError(existing.error);
    const existingRecords = recordsResponseSchema.shape.records.parse(
      existing.data ?? [],
    );
    const previous = existingRecords.find((record) => record.id === input.id);
    const sensitive =
      !input.gameId ||
      (!!previous &&
        (normalizedTitle(previous.title) !== normalizedTitle(input.title) ||
          JSON.stringify(previous.pages ?? []) !==
            JSON.stringify(input.pages ?? [])));
    let pages: { game_id: string; url: string }[] = [];
    if (sensitive && !decision.allowDuplicate) {
      const result = await db.from("offers").select("game_id,url");
      if (result.error) databaseError(result.error);
      pages = z
        .array(z.object({ game_id: z.string(), url: z.string() }))
        .parse(result.data ?? []);
    }
    const matches = sensitive
      ? findDuplicates(input, existingRecords, pages)
      : [];
    if (matches.length && !decision.allowDuplicate)
      return Response.json(
        {
          error: "Este juego podría estar repetido.",
          code: "DUPLICATE",
          details: { matches },
        },
        { status: 409 },
      );
    if (input.pages) {
      input.pages = [
        ...new Set(
          input.pages.map((page) => {
            try {
              return parseStoreUrl(page).url;
            } catch {
              return page;
            }
          }),
        ),
      ];
    }
    const { data, error } = await db.rpc("save_record_result", {
      input,
      record_id: input.id ?? null,
      expected: input.updated_at ?? null,
    });
    if (error) databaseError(error);
    return Response.json(data);
  } catch (e) {
    return apiError(e);
  }
}
export async function DELETE(request: Request) {
  try {
    const { db } = await authorized();
    const { id, expected } = z
      .object({ id: z.uuid(), expected: z.string().optional() })
      .parse(await bodyJson(request));
    const { error } = await db.rpc("trash_record", {
      record_id: id,
      expected: expected ?? null,
    });
    if (error) databaseError(error);
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
