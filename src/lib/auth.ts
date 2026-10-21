import "server-only";
import { memberSchema } from "./contracts";
import { databaseError, HttpError } from "./api-errors";
import { serverClient } from "./supabase/server";
export async function authorized() {
  const db = await serverClient();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (
    error &&
    ((error.status && error.status >= 500) ||
      error.name === "AuthRetryableFetchError")
  )
    throw new HttpError(
      "TEMPORARY",
      "No se pudo verificar la sesión. Volvé a intentarlo.",
      503,
    );
  if (error || !user) throw new Error("UNAUTHORIZED");
  const { data: member, error: memberError } = await db
    .from("members")
    .select("*")
    .eq("id", user.id)
    .eq("active", true)
    .maybeSingle();
  if (memberError) databaseError(memberError);
  if (!member) throw Error("FORBIDDEN");
  return { db, user, member: memberSchema.parse(member) };
}
export { errorResponse as apiError } from "./api-errors";
