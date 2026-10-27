import { beforeEach, expect, it, vi } from "vitest";
import { emptyRecord } from "../src/lib/types";
const auth = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", async () => ({
  authorized: auth,
  apiError: (await import("../src/lib/api-errors")).errorResponse,
}));
import { GET, POST } from "../src/app/api/data-checks/route";
const owner = "10000000-0000-4000-8000-000000000001",
  entryId = "20000000-0000-4000-8000-000000000001";
const state = {
  preferences: { review: false, console: false, hours: false },
  dismissals: [],
};
const rpc = vi.fn(),
  eq = vi.fn(),
  single = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  rpc.mockImplementation(async (name) => ({
    data:
      name === "get_data_check_entry"
        ? {
            ...emptyRecord,
            id: entryId,
            title: "Fixture",
            status: "completed",
            rating: null,
          }
        : state,
    error: null,
  }));
  auth.mockResolvedValue({
    user: { id: owner },
    db: { rpc, from: () => ({ select: () => ({ eq }) }) },
  });
});
const post = (body: unknown) =>
  POST(
    new Request("http://fixture/api/data-checks", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
it("loads caller-scoped canonical state with private cache headers", async () => {
  const r = await GET();
  expect(r.status).toBe(200);
  expect(await r.json()).toEqual(state);
  expect(r.headers.get("cache-control")).toBe("private, no-store");
  expect(rpc).toHaveBeenCalledWith("get_data_check_state");
});
it("accepts only typed owner-free commands and sends preferences as individual switches", async () => {
  expect(
    (await post({ action: "preference", key: "review", enabled: true })).status,
  ).toBe(200);
  expect(rpc).toHaveBeenCalledWith("apply_data_check_command", {
    command: { action: "preference", key: "review", enabled: true },
  });
  rpc.mockClear();
  expect(
    (
      await post({
        action: "preference",
        key: "review",
        enabled: true,
        owner_id: owner,
      })
    ).status,
  ).toBe(400);
  expect(rpc).not.toHaveBeenCalled();
});
it("checks dismissal facts against the caller's current active entry", async () => {
  expect(
    (
      await post({
        action: "dismiss",
        entryId,
        kind: "missing-review",
        values: ["completed", null],
      })
    ).status,
  ).toBe(200);
  expect(rpc).toHaveBeenCalledWith("get_data_check_entry", { entry: entryId });
  rpc.mockClear();
  expect(
    (
      await post({
        action: "dismiss",
        entryId,
        kind: "missing-review",
        values: ["playing", null],
      })
    ).status,
  ).toBe(409);
  expect(rpc).not.toHaveBeenCalledWith(
    "apply_data_check_command",
    expect.anything(),
  );
});
it("does not dismiss absent or trashed entries", async () => {
  rpc.mockResolvedValue({ data: null, error: null });
  expect(
    (
      await post({
        action: "dismiss",
        entryId,
        kind: "missing-review",
        values: [],
      })
    ).status,
  ).toBe(404);
});
it.each(["UNAUTHORIZED", "FORBIDDEN"])("enforces %s", async (reason) => {
  auth.mockRejectedValue(Error(reason));
  expect((await GET()).status).toBe(reason === "UNAUTHORIZED" ? 401 : 403);
  expect(rpc).not.toHaveBeenCalled();
});
it("reports outages and malformed state as failures, never empty success", async () => {
  rpc.mockResolvedValueOnce({
    data: null,
    error: { code: "08006", message: "Unavailable" },
  });
  expect((await GET()).status).toBe(503);
  rpc.mockResolvedValueOnce({
    data: { preferences: "bad", dismissals: [] },
    error: null,
  });
  expect((await GET()).status).not.toBe(200);
});
