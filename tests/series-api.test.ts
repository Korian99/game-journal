import { beforeEach, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => vi.fn());
const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", async () => ({
  authorized: auth,
  apiError: (await import("../src/lib/api-errors")).errorResponse,
}));
import { DELETE, GET, POST } from "../src/app/api/series/route";
const id = "56565656-5656-4656-8656-565656565656";
const gameId = "10000000-0000-4000-8000-000000000001";
const updatedAt = "2026-10-21T06:00:00+00:00";
beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue({ db: { rpc } });
});
it("returns only canonical private series records", async () => {
  rpc.mockResolvedValue({
    data: [{ id, name: "Saga", updatedAt, gameIds: [gameId] }],
    error: null,
  });
  const r = await GET();
  expect(r.status).toBe(200);
  expect(await r.json()).toEqual([
    { id, name: "Saga", updatedAt, gameIds: [gameId] },
  ]);
});
it("maps malformed database responses to service unavailable", async () => {
  rpc.mockResolvedValue({
    data: [{ id, name: "Saga", updatedAt, gameIds: ["bad"] }],
    error: null,
  });
  expect((await GET()).status).toBe(503);
  rpc.mockResolvedValue({ data: null, error: null });
  expect(
    (
      await POST(
        new Request("http://local/api/series", {
          method: "POST",
          body: JSON.stringify({ name: "Saga", gameIds: [gameId] }),
        }),
      )
    ).status,
  ).toBe(503);
});
it("trims and validates save commands before the revision-checked RPC", async () => {
  rpc.mockResolvedValue({
    data: { id, name: "Saga", updated_at: updatedAt, game_ids: [gameId] },
    error: null,
  });
  const r = await POST(
    new Request("http://local/api/series", {
      method: "POST",
      body: JSON.stringify({ name: " Saga ", gameIds: [gameId] }),
    }),
  );
  expect(r.status).toBe(200);
  expect(rpc).toHaveBeenCalledWith("save_game_series", {
    series_id: null,
    series_name: "Saga",
    game_ids: [gameId],
    expected_updated_at: null,
  });
});
it("accepts PostgreSQL offset timestamps for revision-checked delete", async () => {
  rpc.mockResolvedValue({ data: true, error: null });
  const r = await DELETE(
    new Request("http://local/api/series", {
      method: "DELETE",
      body: JSON.stringify({ id, updatedAt }),
    }),
  );
  expect(r.status).toBe(200);
  expect(rpc).toHaveBeenCalledWith("delete_game_series", {
    series_id: id,
    expected_updated_at: updatedAt,
  });
  rpc.mockResolvedValue({ data: false, error: null });
  const failed = await DELETE(
    new Request("http://local/api/series", {
      method: "DELETE",
      body: JSON.stringify({ id, updatedAt }),
    }),
  );
  expect(failed.status).toBe(503);
});

it.each(["UNAUTHORIZED", "FORBIDDEN"])(
  "uses application auth errors for %s",
  async (reason) => {
    auth.mockRejectedValue(Error(reason));
    expect((await GET()).status).toBe(reason === "UNAUTHORIZED" ? 401 : 403);
    expect(rpc).not.toHaveBeenCalled();
  },
);
it("rejects owner supplied in save body before RPC", async () => {
  const r = await POST(
    new Request("http://local/api/series", {
      method: "POST",
      body: JSON.stringify({ name: "Saga", gameIds: [gameId], owner_id: id }),
    }),
  );
  expect(r.status).toBe(400);
  expect(rpc).not.toHaveBeenCalled();
});
it("preserves database CONFLICT as 409", async () => {
  rpc.mockResolvedValue({
    data: null,
    error: { message: "CONFLICT stale", code: "P0001" },
  });
  const r = await POST(
    new Request("http://local/api/series", {
      method: "POST",
      body: JSON.stringify({ name: "Saga", gameIds: [gameId] }),
    }),
  );
  expect(r.status).toBe(409);
});
