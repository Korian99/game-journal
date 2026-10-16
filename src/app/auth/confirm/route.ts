import { NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase/server";
export async function GET(request: Request) {
  const u = new URL(request.url);
  const token = u.searchParams.get("token_hash");
  const type = u.searchParams.get("type");
  if (token && (type === "invite" || type === "recovery")) {
    const db = await serverClient();
    const { error } = await db.auth.verifyOtp({ token_hash: token, type });
    if (!error) return NextResponse.redirect(new URL("/password", u.origin));
  }
  return NextResponse.redirect(new URL("/login?error=link", u.origin));
}
