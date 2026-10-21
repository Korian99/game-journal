import { beforeEach, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", () => ({
  authorized: auth,
  apiError: (error: Error) =>
    Response.json({ error: error.message }, { status: 400 }),
}));
import { DELETE } from "../src/app/api/records/route";
beforeEach(() => vi.resetAllMocks());
it("moves a confirmed deletion into trash instead of physically deleting the playthrough", async () => {
  const rpc = vi.fn(async () => ({ data: { ok: true }, error: null }));
  auth.mockResolvedValue({ db: { rpc }, user: { id: "owner" } });
  const response = await DELETE(
    new Request("http://fixture/api/records", {
      method: "DELETE",
      body: JSON.stringify({
        id: "10000000-0000-4000-8000-000000000001",
        expected: "2026-10-21T12:00:00Z",
      }),
    }),
  );
  expect(response.status).toBe(200);
  expect(rpc).toHaveBeenCalledWith("trash_record", {
    record_id: "10000000-0000-4000-8000-000000000001",
    expected: "2026-10-21T12:00:00Z",
  });
});
