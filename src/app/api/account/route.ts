import { authorized, apiError } from "@/lib/auth";
export async function GET() {
  try {
    const { db, user, member } = await authorized();
    const { data: key } = await db.rpc("push_public_key");
    return Response.json(
      {
        email: user.email,
        name: member.display_name,
        role: member.role,
        googleReady: !!(
          process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID &&
          process.env.NEXT_PUBLIC_GOOGLE_API_KEY &&
          process.env.NEXT_PUBLIC_GOOGLE_APP_ID
        ),
        vapidPublicKey: key,
        pushReady: !!key,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return apiError(e);
  }
}
