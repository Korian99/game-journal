import { authorized, apiError } from "@/lib/auth";
import { bodyJson } from "@/lib/validation";
import { HttpError, databaseError } from "@/lib/api-errors";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { CodeChallengeMethod } from "google-auth-library";
import { sha256, manifestSchema } from "@/lib/backups/bundle";
import {
  driveBackupConfigured,
  driveAdmin,
  driveClient,
  okSchema,
  performDriveBackup,
} from "@/lib/backups/server";
import { googleOAuthClient } from "@/lib/backups/drive";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store" };
export async function GET(request: Request) {
  try {
    const { db, user } = await authorized();
    if (!driveBackupConfigured())
      return Response.json(
        {
          configured: false,
          connected: false,
          state: "disconnected",
          folderId: null,
          errorCode: null,
          recoveryVerifiedAt: null,
          latest: null,
          lastSuccess: null,
          checkedAt: new Date().toISOString(),
        },
        { headers },
      );
    const download = new URL(request.url).searchParams.get("download");
    if (download) {
      const kind = z.enum(["json", "excel"]).parse(download);
      const credentials = await driveAdmin(
        "credentials",
        user.id,
        {},
        z.object({ folderId: z.string(), refreshToken: z.string() }),
      );
      const { data, error } = await db
        .from("external_backup_runs")
        .select("id,file_ids,manifest")
        .eq("owner_id", user.id)
        .eq("status", "succeeded")
        .is("pruned_at", null)
        .order("verified_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) databaseError(error);
      if (!data)
        throw new HttpError(
          "NOT_FOUND",
          "Todavía no hay una copia disponible.",
          404,
        );
      const run = z
          .object({
            id: z.string(),
            file_ids: z.record(z.string(), z.string()),
            manifest: manifestSchema,
          })
          .parse(data),
        artifact = run.manifest.files[kind];
      const bytes = await driveClient(
        credentials.refreshToken,
      ).downloadVerified(
        run.file_ids[kind],
        artifact,
        user.id,
        run.id,
        credentials.folderId,
      );
      return new Response(Buffer.from(bytes), {
        headers: {
          ...headers,
          "Content-Type":
            kind === "json"
              ? "application/json"
              : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition":
            'attachment; filename="' +
            artifact.name.replace(/["\r\n]/g, "") +
            '"',
        },
      });
    }
    const { data, error } = await db.rpc("drive_backup_status");
    if (error) databaseError(error);
    return Response.json({ configured: true, ...data }, { headers });
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    const { user } = await authorized();
    if (!driveBackupConfigured())
      throw new HttpError(
        "CONFIGURATION",
        "Las copias en Drive todavía no están habilitadas.",
        503,
      );
    const { action } = z
      .object({ action: z.enum(["connect", "retry"]) })
      .parse(await bodyJson(request));
    if (action === "retry") {
      await driveAdmin("retry", user.id, {}, okSchema);
      return Response.json(await performDriveBackup(user.id), { headers });
    }
    const oauth = googleOAuthClient(),
      state = randomBytes(32).toString("base64url"),
      { codeVerifier, codeChallenge } = await oauth.generateCodeVerifierAsync();
    await driveAdmin(
      "oauth_begin",
      user.id,
      { stateHash: sha256(state), verifier: codeVerifier },
      okSchema,
    );
    const url = oauth.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: ["https://www.googleapis.com/auth/drive.file"],
      state,
      code_challenge: codeChallenge,
      code_challenge_method: CodeChallengeMethod.S256,
    });
    return Response.json({ url }, { headers });
  } catch (error) {
    return apiError(error);
  }
}
export async function DELETE() {
  try {
    const { user } = await authorized();
    const credentials = await driveAdmin(
      "credentials",
      user.id,
      {},
      z.object({ refreshToken: z.string().nullable() }),
    );
    await driveAdmin("disconnect", user.id, {}, okSchema);
    if (credentials.refreshToken) {
      try {
        await googleOAuthClient().revokeToken(credentials.refreshToken);
      } catch {
        /* Local disconnect has already removed future access. */
      }
    }
    return Response.json({ ok: true }, { headers });
  } catch (error) {
    return apiError(error);
  }
}
