import { authorized, apiError } from "@/lib/auth";
import { searchSteamTitles } from "@/lib/offers/store-search";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await authorized();
    const results = await searchSteamTitles(
      new URL(request.url).searchParams.get("q") ?? "",
      request.signal,
    );
    return Response.json(
      { results },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
