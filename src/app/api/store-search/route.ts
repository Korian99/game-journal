import { z } from "zod";
import { authorized, apiError } from "@/lib/auth";
import { searchNintendoTitles } from "@/lib/offers/nintendo-search";
import { searchSteamTitles } from "@/lib/offers/store-search";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await authorized();
    const params = new URL(request.url).searchParams;
    const store = z
      .enum(["steam", "nintendo"])
      .default("steam")
      .parse(params.get("store") ?? undefined);
    const term = params.get("q") ?? "";
    const results =
      store === "steam"
        ? await searchSteamTitles(term, request.signal)
        : await searchNintendoTitles(term, request.signal);
    return Response.json(
      { results },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
