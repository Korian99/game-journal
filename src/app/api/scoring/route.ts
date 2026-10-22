import { authorized, apiError } from "@/lib/auth";
import { databaseError } from "@/lib/api-errors";
import { bodyJson } from "@/lib/validation";
import { defaultScoringGuide, scoringGuideSchema } from "@/lib/scoring-guide";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
export async function GET() {
  try {
    const { db, user } = await authorized();
    const { data, error } = await db
      .from("scoring_guide")
      .select("score_threshold, meaning")
      .eq("owner_id", user.id)
      .order("score_threshold", { ascending: false });
    if (error) databaseError(error);
    const guide = scoringGuideSchema.parse({
      entries: data?.length ? data : defaultScoringGuide,
    });
    return Response.json(guide, { headers });
  } catch (error) {
    return apiError(error);
  }
}
export async function PUT(request: Request) {
  try {
    const { db } = await authorized();
    const input = scoringGuideSchema.parse(await bodyJson(request));
    const { data, error } = await db.rpc("replace_scoring_guide", {
      entries: input.entries,
    });
    if (error) databaseError(error);
    return Response.json(scoringGuideSchema.parse({ entries: data }), {
      headers,
    });
  } catch (error) {
    return apiError(error);
  }
}
