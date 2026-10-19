import { it, expect, vi, beforeEach } from "vitest";
const auth = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", () => ({
  authorized: auth,
  apiError: (e: Error) =>
    Response.json(
      { error: e.message },
      { status: e.message === "UNAUTHORIZED" ? 401 : 400 },
    ),
}));
import { GET, PUT, POST } from "../src/app/api/notification-settings/route";
let db: any;
let row: any;
let updates: any[];
beforeEach(() => {
  vi.clearAllMocks();
  updates = [];
  row = { discounts: true, targets: true, releases: true };
  const query: any = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => ({ data: row, error: null }),
    single: async () => ({ data: row, error: null }),
    update: (value: any) => {
      updates.push(value);
      return query;
    },
    then: (resolve: any) => resolve({ data: row, error: null }),
  };
  db = {
    from: vi.fn(() => query),
    rpc: vi.fn().mockResolvedValue({ data: "event", error: null }),
    functions: {
      invoke: vi
        .fn()
        .mockResolvedValue({
          data: { sent: 1, sentEventIds: ["event"] },
          error: null,
        }),
    },
  };
  auth.mockResolvedValue({ db, user: { id: "owner" } });
});
const request = (body: any) =>
  new Request("http://local/api/notification-settings", {
    method: "POST",
    body: JSON.stringify(body),
  });
it("loads account preferences privately", async () => {
  const response = await GET();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(row);
  expect(response.headers.get("Cache-Control")).toContain("no-store");
});
it("accepts only the three boolean switches, not owner or dates", async () => {
  expect(
    (await PUT(request({ discounts: false, targets: true, releases: false })))
      .status,
  ).toBe(200);
  expect(updates).toEqual([
    { discounts: false, targets: true, releases: false },
  ]);
  expect(
    (
      await PUT(
        request({
          discounts: true,
          targets: true,
          releases: true,
          owner_id: "someone-else",
        }),
      )
    ).status,
  ).not.toBe(200);
});
it("tests only a subscribed device and invokes the dedicated worker", async () => {
  const response = await POST(
    request({ action: "test", endpoint: "https://fcm.googleapis.com/test" }),
  );
  expect(response.status).toBe(200);
  expect((await response.json()).sent).toBe(true);
  expect(db.rpc).toHaveBeenCalledWith("request_test_notification", {
    endpoint: "https://fcm.googleapis.com/test",
  });
  expect(db.functions.invoke).toHaveBeenCalledWith("notification-worker", {
    body: {},
  });
  row = null;
  db.rpc.mockClear();
  expect(
    (
      await POST(
        request({
          action: "test",
          endpoint: "https://fcm.googleapis.com/test",
        }),
      )
    ).status,
  ).not.toBe(200);
  expect(db.rpc).not.toHaveBeenCalled();
});
it("does not dispatch unsafe endpoints or anonymous tests", async () => {
  expect(
    (
      await POST(
        request({ action: "test", endpoint: "https://127.0.0.1/private" }),
      )
    ).status,
  ).not.toBe(200);
  expect(db.functions.invoke).not.toHaveBeenCalled();
  auth.mockRejectedValue(Error("UNAUTHORIZED"));
  expect((await GET()).status).toBe(401);
});
