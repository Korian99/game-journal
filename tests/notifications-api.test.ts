import { beforeEach, it, expect, vi } from "vitest";
const auth = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", () => ({
  authorized: auth,
  apiError: (error: Error) =>
    Response.json({ error: error.message }, { status: 400 }),
}));
import { GET, PATCH } from "../src/app/api/notifications/route";
beforeEach(() => vi.clearAllMocks());
function setup() {
  const calls: unknown[][] = [];
  const db = {
    from: (table: string) => {
      calls.push(["from", table]);
      let head = false;
      const query = {
        select: (_columns: string, options?: { head?: boolean }) => {
          head = !!options?.head;
          return query;
        },
        update: (value: unknown) => {
          calls.push(["update", value]);
          return query;
        },
        eq: (key: string, value: unknown) => {
          calls.push(["eq", key, value]);
          return query;
        },
        is: (key: string, value: unknown) => {
          calls.push(["is", key, value]);
          return query;
        },
        order: () => query,
        limit: () => query,
        or: () => query,
        in: (key: string, value: unknown) => {
          calls.push(["in", key, value]);
          return query;
        },
        lte: (key: string, value: unknown) => {
          calls.push(["lte", key, value]);
          return query;
        },
        then: (resolve: (result: unknown) => unknown) =>
          Promise.resolve(
            resolve({ data: [], count: head ? 345 : null, error: null }),
          ),
      };
      return query;
    },
  };
  auth.mockResolvedValue({ db, user: { id: "fixture-owner" } });
  return calls;
}
it("returns an exact count independently of page size, scoped to the authenticated owner", async () => {
  const calls = setup(),
    response = await GET(
      new Request("http://fixture/api/notifications?read=unread&kind=target"),
    ),
    body = await response.json();
  expect(body.unreadCount).toBe(345);
  expect(body.items).toEqual([]);
  expect(
    calls.filter((call) => call[0] === "eq" && call[1] === "owner_id"),
  ).toEqual([
    ["eq", "owner_id", "fixture-owner"],
    ["eq", "owner_id", "fixture-owner"],
  ]);
  expect(calls).toContainEqual(["eq", "kind", "target"]);
});
it("marks only requested IDs or records before the selected cutoff", async () => {
  const id = "10000000-0000-4000-8000-000000000001",
    calls = setup();
  expect(
    (
      await PATCH(
        new Request("http://fixture/api/notifications", {
          method: "PATCH",
          body: JSON.stringify({ ids: [id] }),
        }),
      )
    ).status,
  ).toBe(200);
  expect(calls).toContainEqual(["in", "id", [id]]);
  expect(calls).toContainEqual(["eq", "owner_id", "fixture-owner"]);
  const next = setup(),
    cutoff = "2026-10-21T12:00:00Z";
  await PATCH(
    new Request("http://fixture/api/notifications", {
      method: "PATCH",
      body: JSON.stringify({ allBefore: cutoff }),
    }),
  );
  expect(next).toContainEqual(["lte", "created_at", cutoff]);
});

it("looks up a notification ID while retaining owner scoping", async () => {
  const calls = setup(),
    id = "10000000-0000-4000-8000-000000000001";
  expect(
    (await GET(new Request("http://fixture/api/notifications?id=" + id)))
      .status,
  ).toBe(200);
  expect(calls).toContainEqual(["eq", "id", id]);
  expect(calls).toContainEqual(["eq", "owner_id", "fixture-owner"]);
});
it("rejects an invalid notification lookup ID", async () => {
  setup();
  expect(
    (await GET(new Request("http://fixture/api/notifications?id=invalid")))
      .status,
  ).toBe(400);
});
