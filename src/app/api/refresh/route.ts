import { authorized, apiError } from "@/lib/auth";
export async function POST() {
  try {
    const { db } = await authorized();
    const { data, error } = await db.functions.invoke("price-worker", {
      body: { manual: true },
    });
    if (error) throw Error("No se pudo actualizar: " + error.message);
    return Response.json(data);
  } catch (e) {
    return apiError(e);
  }
}
