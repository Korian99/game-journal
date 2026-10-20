export async function apiRequest(path: string, method = "GET", body?: unknown) {
  const response = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok)
    throw Error(data.error ?? "No se pudo completar la operación");
  return data;
}
