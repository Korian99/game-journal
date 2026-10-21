import { authorized } from "@/lib/auth";
import { driveAdmin, okSchema } from "@/lib/backups/server";
import {
  googleOAuthClient,
  GoogleDriveBackupClient,
} from "@/lib/backups/drive";
import { sha256 } from "@/lib/backups/bundle";
import { z } from "zod";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const target = new URL(
    "/?tab=settings&backup=error",
    process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin,
  );
  try {
    const { db, user } = await authorized(),
      params = new URL(request.url).searchParams;
    const input = z
      .object({
        code: z.string().min(1).max(4000),
        state: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
      })
      .parse({ code: params.get("code"), state: params.get("state") });
    const { verifier } = await driveAdmin(
      "oauth_consume",
      user.id,
      { stateHash: sha256(input.state) },
      z.object({ verifier: z.string() }),
    );
    const oauth = googleOAuthClient();
    const { tokens } = await oauth.getToken({
      code: input.code,
      codeVerifier: verifier,
    });
    if (!tokens.refresh_token)
      throw Error("Se necesita una nueva autorización.");
    oauth.setCredentials(tokens);
    const previous = await db.rpc("drive_backup_status");
    if (previous.error)
      throw Error("No se pudo verificar la conexión anterior.");
    const { folderId: existingId } = z
      .object({ folderId: z.string().nullable() })
      .parse(previous.data);
    const folderId = await new GoogleDriveBackupClient(oauth).getOrCreateFolder(
      user.id,
      existingId,
    );
    await driveAdmin(
      "connect",
      user.id,
      { refreshToken: tokens.refresh_token, folderId },
      okSchema,
    );
    target.searchParams.set("backup", "connected");
  } catch {
    /* Never put OAuth codes, tokens, provider responses or private errors into redirects. */
  }
  return Response.redirect(target, 303);
}
