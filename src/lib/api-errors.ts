import { ZodError } from "zod";
export class HttpError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function errorResponse(error: unknown) {
  if (error instanceof ZodError)
    return Response.json(
      {
        error: "Revisá los campos indicados.",
        code: "VALIDATION",
        fieldErrors: Object.fromEntries(
          error.issues.map((issue) => [issue.path.join("."), issue.message]),
        ),
      },
      { status: 400 },
    );
  const message = error instanceof Error ? error.message : "Error inesperado";
  const code =
    error instanceof HttpError
      ? error.code
      : message === "UNAUTHORIZED"
        ? "UNAUTHORIZED"
        : message === "FORBIDDEN"
          ? "FORBIDDEN"
          : message.includes("CONFLICT")
            ? "CONFLICT"
            : message === "NOT_FOUND"
              ? "NOT_FOUND"
              : message === "GONE"
                ? "GONE"
                : "VALIDATION";
  const status =
    error instanceof HttpError
      ? error.status
      : code === "UNAUTHORIZED"
        ? 401
        : code === "FORBIDDEN"
          ? 403
          : code === "CONFLICT"
            ? 409
            : code === "NOT_FOUND"
              ? 404
              : code === "GONE"
                ? 410
                : 400;
  return Response.json(
    {
      error:
        code === "UNAUTHORIZED"
          ? "Iniciá sesión."
          : code === "FORBIDDEN"
            ? "Tu cuenta todavía no tiene acceso."
            : message,
      code,
    },
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}
export function databaseError(error: {
  message: string;
  code?: string;
}): never {
  if (/CONFLICT|GONE|NOT_FOUND|FORBIDDEN|UNAUTHORIZED/.test(error.message))
    throw new Error(error.message);
  if (error.code === "23505")
    throw new HttpError(
      "CONFLICT",
      "Este registro ya existe. Actualizá la vista antes de continuar.",
      409,
    );
  if (error.code === "42501")
    throw new HttpError("FORBIDDEN", "No tenés acceso a esta operación.", 403);
  if (
    error.code?.startsWith("22") ||
    error.code === "23514" ||
    error.code === "P0001"
  )
    throw new HttpError("VALIDATION", error.message, 400);
  throw new HttpError(
    "TEMPORARY",
    "No se pudo consultar la base de datos. Volvé a intentarlo.",
    503,
  );
}
