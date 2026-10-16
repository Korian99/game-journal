import { authorized, apiError } from "@/lib/auth";
import { bodyJson } from "@/lib/validation";
import { z } from "zod";
export async function POST(request: Request) {
  try {
    const { db, member } = await authorized();
    if (member.role !== "admin") throw Error("FORBIDDEN");
    const { email } = z
      .object({ email: z.email() })
      .parse(await bodyJson(request));
    const { data, error } = await db.functions.invoke("account-admin", {
      body: { email, origin: process.env.NEXT_PUBLIC_APP_URL },
    });
    if (error) throw Error("No se pudo generar el enlace.");
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return apiError(e);
  }
}
