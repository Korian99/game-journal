import { z } from "zod";
import { authorized, apiError } from "@/lib/auth";
import { bodyJson } from "@/lib/validation";
import { loadStorePreview } from "@/lib/offers/store-preview";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    await authorized();
    const input = z
      .object({ url: z.string().trim().min(1).max(2000) })
      .parse(await bodyJson(request));
    const preview = await loadStorePreview(input.url, request.signal);
    return Response.json(preview, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}
