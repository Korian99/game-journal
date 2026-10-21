import { OAuth2Client } from "google-auth-library";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { sha256, type BackupArtifact } from "./bundle";
import {
  DriveBackupError,
  type BackupDriveClient,
  type FileIds,
} from "./worker";
const fileSchema = z.object({
  id: z.string(),
  parents: z.array(z.string()).default([]),
  appProperties: z.record(z.string(), z.string()).default({}),
  trashed: z.boolean().optional(),
  ownedByMe: z.boolean().optional(),
  mimeType: z.string().optional(),
  permissions: z.array(z.object({ role: z.string() })).optional(),
});
export function googleOAuthClient() {
  const clientId = process.env.GOOGLE_BACKUP_CLIENT_ID,
    clientSecret = process.env.GOOGLE_BACKUP_CLIENT_SECRET,
    origin = process.env.NEXT_PUBLIC_APP_URL;
  if (!clientId || !clientSecret || !origin)
    throw new DriveBackupError(
      "CONFIGURATION",
      "Google Drive todavía no está habilitado.",
    );
  return new OAuth2Client({
    clientId,
    clientSecret,
    redirectUri: new URL("/api/backups/drive/callback", origin).href,
  });
}
export class GoogleDriveBackupClient implements BackupDriveClient {
  constructor(
    private oauth: OAuth2Client,
    private requestFetch: typeof fetch = fetch,
    private deadline = Date.now() + 45000,
  ) {}
  private async request(
    path: string,
    options: RequestInit = {},
  ): Promise<Response> {
    let token: string | null | undefined;
    try {
      token = (await this.oauth.getAccessToken()).token;
    } catch (error) {
      const parsed = z
        .object({
          response: z
            .object({
              status: z.number(),
              data: z.object({ error: z.string() }).optional(),
            })
            .optional(),
        })
        .safeParse(error);
      throw new DriveBackupError(
        parsed.success && parsed.data.response?.data?.error === "invalid_grant"
          ? "AUTH_REVOKED"
          : "TEMPORARY",
        "No se pudo autorizar Google Drive.",
      );
    }
    if (!token)
      throw new DriveBackupError("AUTH_REVOKED", "Reconectá Google Drive.");
    const remaining = this.deadline - Date.now();
    if (remaining <= 0)
      throw new DriveBackupError(
        "TEMPORARY",
        "La copia continuará en el próximo intento.",
      );
    let response: Response;
    try {
      response = await this.requestFetch("https://www.googleapis.com/" + path, {
        ...options,
        headers: { ...options.headers, Authorization: "Bearer " + token },
        signal: AbortSignal.timeout(Math.min(10000, remaining)),
      });
    } catch {
      throw new DriveBackupError(
        "TEMPORARY",
        "No se pudo conectar con Google Drive.",
      );
    }
    if (!response.ok && ![404, 409].includes(response.status))
      throw new DriveBackupError(
        response.status === 401
          ? "AUTH_REVOKED"
          : response.status === 403
            ? "DRIVE_PERMISSION"
            : "TEMPORARY",
        "Google Drive no pudo completar la copia.",
      );
    return response;
  }
  async getOrCreateFolder(ownerId: string, existingId?: string | null) {
    if (existingId) {
      await this.verifyFolder(existingId, ownerId);
      return existingId;
    }
    const escaped = ownerId.replaceAll("\\", "\\\\").replaceAll("'", "\\'");
    const q =
      "mimeType = 'application/vnd.google-apps.folder' and trashed = false and appProperties has { key='gameJournal' and value='backup-folder' } and appProperties has { key='ownerId' and value='" +
      escaped +
      "' }";
    const response = await this.request(
      "drive/v3/files?" +
        new URLSearchParams({
          q,
          fields: "files(id)",
          pageSize: "1",
          orderBy: "createdTime",
        }),
    );
    if (!response.ok)
      throw new DriveBackupError(
        "TEMPORARY",
        "No se pudo consultar la carpeta de respaldos.",
      );
    const result = z
      .object({ files: z.array(z.object({ id: z.string() })) })
      .parse(await response.json());
    const folder = result.files[0]?.id;
    if (folder) {
      await this.verifyFolder(folder, ownerId);
      return folder;
    }
    return this.createFolder(ownerId);
  }
  async createFolder(ownerId: string) {
    const response = await this.request("drive/v3/files?fields=id", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Game Journal Backups",
        mimeType: "application/vnd.google-apps.folder",
        appProperties: { gameJournal: "backup-folder", ownerId },
      }),
    });
    if (!response.ok)
      throw new DriveBackupError(
        "DRIVE_PERMISSION",
        "No se pudo crear la carpeta privada.",
      );
    return z
      .object({ id: z.string().regex(/^[a-zA-Z0-9_-]+$/) })
      .parse(await response.json()).id;
  }
  async verifyFolder(folderId: string, ownerId: string) {
    const response = await this.request(
      "drive/v3/files/" +
        encodeURIComponent(folderId) +
        "?fields=id,mimeType,ownedByMe,trashed,appProperties,permissions(role)",
    );
    if (!response.ok)
      throw new DriveBackupError(
        "FOLDER_MISSING",
        "No se encontró la carpeta de respaldos.",
      );
    const file = fileSchema.parse(await response.json());
    if (
      file.trashed ||
      file.ownedByMe !== true ||
      file.mimeType !== "application/vnd.google-apps.folder" ||
      file.appProperties.gameJournal !== "backup-folder" ||
      file.appProperties.ownerId !== ownerId ||
      !file.permissions?.length ||
      file.permissions.some((permission) => permission.role !== "owner")
    )
      throw new DriveBackupError(
        "DRIVE_PERMISSION",
        "La carpeta de respaldos debe ser privada y pertenecer a esta conexión.",
      );
  }
  async reserveIds(): Promise<FileIds> {
    const response = await this.request(
      "drive/v3/files/generateIds?count=3&space=drive&type=files",
    );
    if (!response.ok)
      throw new DriveBackupError(
        "TEMPORARY",
        "No se pudieron reservar los archivos.",
      );
    const { ids } = z
      .object({ ids: z.array(z.string()).length(3) })
      .parse(await response.json());
    return { json: ids[0], excel: ids[1], manifest: ids[2] };
  }
  private async ownedFile(
    id: string,
    ownerId: string,
    runId: string,
    folderId: string,
  ) {
    const response = await this.request(
      "drive/v3/files/" +
        encodeURIComponent(id) +
        "?fields=id,parents,appProperties,trashed",
    );
    if (response.status === 404) return null;
    const file = fileSchema.parse(await response.json());
    if (
      file.trashed ||
      !file.parents.includes(folderId) ||
      file.appProperties.gameJournal !== "backup" ||
      file.appProperties.ownerId !== ownerId ||
      file.appProperties.runId !== runId
    )
      throw new DriveBackupError(
        "INTEGRITY",
        "El archivo no pertenece a este respaldo.",
      );
    return file;
  }
  async downloadVerified(
    id: string,
    artifact: Pick<BackupArtifact, "sha256">,
    ownerId: string,
    runId: string,
    folderId: string,
  ) {
    if (!(await this.ownedFile(id, ownerId, runId, folderId)))
      throw new DriveBackupError("INTEGRITY", "Falta un archivo del respaldo.");
    const response = await this.request(
      "drive/v3/files/" + encodeURIComponent(id) + "?alt=media",
    );
    if (!response.ok)
      throw new DriveBackupError(
        "TEMPORARY",
        "No se pudo verificar la descarga.",
      );
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (sha256(bytes) !== artifact.sha256)
      throw new DriveBackupError("INTEGRITY", "Backup checksum mismatch");
    return bytes;
  }
  async uploadAndVerify(
    id: string,
    artifact: BackupArtifact,
    ownerId: string,
    runId: string,
    folderId: string,
  ) {
    const boundary = "journal-" + randomUUID(),
      metadata = {
        id,
        name: artifact.name,
        mimeType: artifact.mime,
        parents: [folderId],
        appProperties: { gameJournal: "backup", ownerId, runId },
      };
    const body = Buffer.concat([
      Buffer.from(
        "--" +
          boundary +
          "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" +
          JSON.stringify(metadata) +
          "\r\n--" +
          boundary +
          "\r\nContent-Type: " +
          artifact.mime +
          "\r\n\r\n",
      ),
      Buffer.from(artifact.bytes),
      Buffer.from("\r\n--" + boundary + "--"),
    ]);
    const response = await this.request(
      "upload/drive/v3/files?uploadType=multipart&fields=id",
      {
        method: "POST",
        headers: { "Content-Type": "multipart/related; boundary=" + boundary },
        body,
      },
    );
    if (!response.ok && response.status !== 409)
      throw new DriveBackupError("TEMPORARY", "No se pudo subir el archivo.");
    await this.downloadVerified(id, artifact, ownerId, runId, folderId);
  }
  async deleteVerified(
    id: string,
    ownerId: string,
    runId: string,
    folderId: string,
  ) {
    if (!(await this.ownedFile(id, ownerId, runId, folderId))) return;
    const response = await this.request(
      "drive/v3/files/" + encodeURIComponent(id),
      { method: "DELETE" },
    );
    if (!response.ok && response.status !== 404)
      throw new DriveBackupError(
        "TEMPORARY",
        "No se pudo completar la retención.",
      );
  }
}
