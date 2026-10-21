import { afterEach, expect, it, vi } from "vitest";
const { perform, configured } = vi.hoisted(() => ({
  perform: vi.fn(),
  configured: vi.fn(() => true),
}));
vi.mock("@/lib/backups/server", () => ({
  performDriveBackup: perform,
  driveBackupConfigured: configured,
}));
import { POST } from "../src/app/api/internal/backup-drive/route";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
it("rejects cron requests before any credential-bearing work starts", async () => {
  vi.stubEnv("BACKUP_WORKER_SECRET", "SYNTHETIC");
  expect(
    (
      await POST(
        new Request("http://fixture/api/internal/backup-drive", {
          method: "POST",
        }),
      )
    ).status,
  ).toBe(401);
  expect(perform).not.toHaveBeenCalled();
});
it("runs the worker only for the dedicated secret", async () => {
  vi.stubEnv("BACKUP_WORKER_SECRET", "SYNTHETIC");
  perform.mockResolvedValue({ processed: false, status: "idle" });
  expect(
    (
      await POST(
        new Request("http://fixture/api/internal/backup-drive", {
          method: "POST",
          headers: { Authorization: "Bearer SYNTHETIC" },
        }),
      )
    ).status,
  ).toBe(200);
  expect(perform).toHaveBeenCalledWith(null);
});
