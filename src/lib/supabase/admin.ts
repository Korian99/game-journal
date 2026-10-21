import "server-only";
import { createClient } from "@supabase/supabase-js";
import { HttpError } from "../api-errors";
export function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new HttpError(
      "CONFIGURATION",
      "Esta función todavía no está habilitada.",
      503,
    );
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
