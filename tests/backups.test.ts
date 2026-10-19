import { expect, it, vi, beforeEach } from "vitest";
import { backupWarning } from "../src/lib/backups";
const auth = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", () => ({
  authorized: auth,
  apiError: (e: Error) =>
    Response.json(
      { error: e.message },
      { status: e.message === "UNAUTHORIZED" ? 401 : 400 },
    ),
}));
import { GET } from "../src/app/api/backups/route";
const now = Date.parse("2026-10-20T06:00:00Z");
const success = {
  id: "one",
  status: "succeeded",
  completed_at: "2026-10-19T06:00:00Z",
};
const status = {
  latest: success,
  lastSuccess: success,
  checkedAt: "2026-10-20T06:00:00Z",
};
it("warns for no backup, invalid date, future date and an unverified status", () => {
  expect(
    backupWarning(
      { latest: null, lastSuccess: null, checkedAt: status.checkedAt },
      now,
    ),
  ).toContain("Todavía");
  expect(
    backupWarning(
      { ...status, lastSuccess: { ...success, completed_at: "bad" } },
      now,
    ),
  ).toContain("verificar");
  expect(
    backupWarning(
      {
        ...status,
        lastSuccess: { ...success, completed_at: "2026-10-21T06:00:00Z" },
      },
      now,
    ),
  ).toContain("verificar");
  expect(backupWarning(null, now)).toContain("verificar");
});
it("warns at 48 hours since the last SUCCESS even if a newer run failed", () => {
  expect(backupWarning(status, now)).toBe("");
  expect(backupWarning(status, now + 24 * 3600_000)).toContain("48 horas");
  expect(
    backupWarning(
      {
        ...status,
        latest: { id: "two", status: "failed", completed_at: status.checkedAt },
      },
      now,
    ),
  ).toContain("falló");
  expect(
    backupWarning(
      {
        ...status,
        latest: {
          id: "two",
          status: "running",
          started_at: "2026-10-20T05:00:00Z",
        },
      },
      now,
    ),
  ).toContain("completó");
});
beforeEach(() => {
  vi.clearAllMocks();
});
it("returns only the authenticated backup status without caching", async () => {
  const rpc = vi.fn().mockResolvedValue({ data: status, error: null });
  auth.mockResolvedValue({ db: { rpc } });
  const response = await GET(new Request("http://local/api/backups"));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(status);
  expect(response.headers.get("Cache-Control")).toContain("no-store");
  expect(rpc).toHaveBeenCalledWith("backup_status");
});
it("download refuses an absent snapshot and database failures", async () => {
  const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
  auth.mockResolvedValue({ db: { rpc } });
  expect(
    (await GET(new Request("http://local/api/backups?download=latest"))).status,
  ).toBe(404);
  rpc.mockResolvedValue({
    data: null,
    error: { message: "Backup checksum mismatch" },
  });
  const response = await GET(
    new Request("http://local/api/backups?download=latest"),
  );
  expect(response.status).not.toBe(200);
  expect(response.headers.get("Content-Disposition")).toBeNull();
});
it("downloads a saved snapshot rather than exporting current data", async () => {
  const payload = {
    version: 3,
    records: [{ title: "Before deletion" }],
    exportedAt: "2026-10-19T06:00:00Z",
  };
  const rpc = vi.fn().mockResolvedValue({ data: payload, error: null });
  auth.mockResolvedValue({ db: { rpc } });
  const response = await GET(
    new Request("http://local/api/backups?download=latest"),
  );
  expect(await response.json()).toEqual(payload);
  expect(response.headers.get("Content-Disposition")).toContain(".json");
  expect(response.headers.get("Cache-Control")).toContain("no-store");
  expect(rpc).toHaveBeenCalledWith("read_latest_backup");
});
it("does not allow anonymous downloads", async () => {
  auth.mockRejectedValue(Error("UNAUTHORIZED"));
  expect(
    (await GET(new Request("http://local/api/backups?download=latest"))).status,
  ).toBe(401);
});
