import type { z } from "zod";
export class ApiRequestError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
    public fieldErrors?: Record<string, string>,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}
export async function apiRequest<T = unknown>(
  path: string,
  method = "GET",
  body?: unknown,
  schema?: z.ZodType<T>,
  signal?: AbortSignal,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      signal: signal ?? AbortSignal.timeout(15000),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new ApiRequestError(
      "No se pudo conectar o confirmar la operación. Volvé a intentarlo.",
      0,
      "NETWORK",
    );
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new ApiRequestError(
      response.ok
        ? "La respuesta del servidor no es válida."
        : "El servicio no está disponible. Volvé a intentarlo.",
      response.status,
      response.ok
        ? "INVALID_RESPONSE"
        : response.status >= 500
          ? "TEMPORARY"
          : "REQUEST_FAILED",
    );
  }
  if (!response.ok) {
    const failure =
      data && typeof data === "object" ? (data as Record<string, unknown>) : {};
    const code =
      typeof failure.code === "string"
        ? failure.code
        : response.status === 401
          ? "UNAUTHORIZED"
          : response.status === 403
            ? "FORBIDDEN"
            : response.status === 409
              ? "CONFLICT"
              : response.status >= 500
                ? "TEMPORARY"
                : "REQUEST_FAILED";
    const fields =
      failure.fieldErrors && typeof failure.fieldErrors === "object"
        ? Object.fromEntries(
            Object.entries(failure.fieldErrors).filter(
              (pair): pair is [string, string] => typeof pair[1] === "string",
            ),
          )
        : undefined;
    throw new ApiRequestError(
      typeof failure.error === "string"
        ? failure.error
        : "No se pudo completar la operación.",
      response.status,
      code,
      fields,
      failure.details,
    );
  }
  if (schema) {
    const parsed = schema.safeParse(data);
    if (!parsed.success)
      throw new ApiRequestError(
        "Los datos recibidos no son válidos. Se conserva la última versión disponible.",
        response.status,
        "INVALID_RESPONSE",
      );
    return parsed.data;
  }
  return data as T;
}

export { createResource } from "./resource";
