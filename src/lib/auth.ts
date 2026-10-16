import "server-only";
import { serverClient } from "./supabase/server";
export async function authorized() {
  const db = await serverClient();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) throw new Error("UNAUTHORIZED");
  const { data: member } = await db
    .from("members")
    .select("*")
    .eq("id", user.id)
    .eq("active", true)
    .single();
  if (!member) throw Error("FORBIDDEN");
  return { db, user, member };
}
export function apiError(error: unknown) {
  const message = error instanceof Error ? error.message : "Error inesperado";
  return Response.json(
    {
      error:
        message === "UNAUTHORIZED"
          ? "Iniciá sesión."
          : message === "FORBIDDEN"
            ? "Tu cuenta todavía no tiene acceso."
            : message,
    },
    {
      status:
        message === "UNAUTHORIZED"
          ? 401
          : message === "FORBIDDEN"
            ? 403
            : message.includes("CONFLICT")
              ? 409
              : 400,
    },
  );
}
