import { afterEach, expect, it, vi } from "vitest";
import { OAuth2Client } from "google-auth-library";
import { GoogleDriveBackupClient } from "../src/lib/backups/drive";
import { sha256 } from "../src/lib/backups/bundle";
afterEach(() => vi.restoreAllMocks());
function oauth() {
  const client = new OAuth2Client();
  client.setCredentials({
    access_token: "SYNTHETIC",
    expiry_date: Date.now() + 3600000,
  });
  return client;
}
const owned = {
  id: "owned",
  parents: ["folder"],
  appProperties: { gameJournal: "backup", ownerId: "owner", runId: "run" },
  trashed: false,
};
it("reuses a pre-generated Drive ID after an upload timeout and verifies the returned bytes", async () => {
  const bytes = Buffer.from("fixture");
  const network = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    if (String(url).includes("/upload/"))
      return Response.json({}, { status: 409 });
    if (String(url).includes("alt=media")) return new Response(bytes);
    return Response.json(owned);
  });
  const client = new GoogleDriveBackupClient(oauth(), network);
  await client.uploadAndVerify(
    "owned",
    {
      name: "fixture.json",
      mime: "application/json",
      bytes,
      sha256: sha256(bytes),
    },
    "owner",
    "run",
    "folder",
  );
  expect(
    network.mock.calls.filter(([, init]) => init?.method === "POST"),
  ).toHaveLength(1);
});
it("never deletes an unrelated Drive file, including a spreadsheet", async () => {
  const network = vi.fn(async () =>
    Response.json({
      ...owned,
      appProperties: {},
      mimeType: "application/vnd.google-apps.spreadsheet",
    }),
  );
  const client = new GoogleDriveBackupClient(oauth(), network);
  await expect(
    client.deleteVerified("sheet", "owner", "run", "folder"),
  ).rejects.toMatchObject({ code: "INTEGRITY" });
  expect(network).toHaveBeenCalledTimes(1);
});
it("rejects a backup folder that has been shared", async () => {
  const network = vi.fn(async () =>
    Response.json({
      id: "folder",
      mimeType: "application/vnd.google-apps.folder",
      ownedByMe: true,
      appProperties: { gameJournal: "backup-folder", ownerId: "owner" },
      permissions: [{ role: "owner" }, { role: "reader" }],
    }),
  );
  await expect(
    new GoogleDriveBackupClient(oauth(), network).verifyFolder(
      "folder",
      "owner",
    ),
  ).rejects.toMatchObject({ code: "DRIVE_PERMISSION" });
});

it("reuses the private app folder when reconnecting", async () => {
  const network = vi.fn(async (url: RequestInfo | URL) =>
    String(url).includes("files?")
      ? Response.json({ files: [{ id: "folder" }] })
      : Response.json({
          id: "folder",
          mimeType: "application/vnd.google-apps.folder",
          ownedByMe: true,
          appProperties: { gameJournal: "backup-folder", ownerId: "owner" },
          permissions: [{ role: "owner" }],
        }),
  );
  const client = new GoogleDriveBackupClient(oauth(), network);
  expect(await client.getOrCreateFolder("owner")).toBe("folder");
  expect(network).toHaveBeenCalledTimes(2);
});
