import { beforeEach, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", async () => ({
  authorized: auth,
  apiError: (await import("../src/lib/api-errors")).errorResponse,
}));
import { GET, PUT } from "../src/app/api/scoring/route";
const entries = [
  { score_threshold: 100, meaning: "Perfecto" },
  { score_threshold: 0, meaning: "Malo" },
];
const rpc = vi.fn();
const eq = vi.fn();
const order = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  order.mockResolvedValue({ data: entries, error: null });
  eq.mockReturnValue({ order });
  auth.mockResolvedValue({
    user: { id: "owner-fixture" },
    db: { from: () => ({ select: () => ({ eq }) }), rpc },
  });
  rpc.mockResolvedValue({ data: entries, error: null });
});
const put = (body: unknown) =>
  PUT(
    new Request("http://fixture/api/scoring", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  );
it("loads only the current owner's guide with private cache headers", async () => {
  const response = await GET();
  expect(eq).toHaveBeenCalledWith("owner_id", "owner-fixture");
  expect(await response.json()).toEqual({ entries });
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});
it("uses the eleven supplied defaults only when no personal rows exist", async () => {
  order.mockResolvedValue({ data: [], error: null });
  const result = await (await GET()).json();
  expect(
    result.entries.map((e: { score_threshold: number }) => e.score_threshold),
  ).toEqual([100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 0]);
  expect(result.entries[10].meaning).toBe("Ofensivamente malo");
});
it("does not hide a failed read behind defaults", async () => {
  order.mockResolvedValue({
    data: null,
    error: { code: "08006", message: "unavailable" },
  });
  expect((await GET()).status).toBe(503);
});
it("saves atomically without accepting a client-provided owner", async () => {
  expect((await put({ entries })).status).toBe(200);
  expect(rpc).toHaveBeenCalledWith("replace_scoring_guide", { entries });
  expect((await put({ entries, owner_id: "someone-else" })).status).toBe(400);
});
it.each(
  [
    [],
    [{ score_threshold: 101, meaning: "No" }],
    [{ score_threshold: 1.5, meaning: "No" }],
    [{ score_threshold: 20, meaning: " " }],
    [{ score_threshold: 20, meaning: "x".repeat(2001) }],
    [
      { score_threshold: 20, meaning: "a" },
      { score_threshold: 20, meaning: "b" },
    ],
  ].map((entries) => ({ entries })),
)("rejects invalid guide $entries without writing", async ({ entries }) => {
  expect((await put({ entries })).status).toBe(400);
  expect(rpc).not.toHaveBeenCalled();
});
it.each(["UNAUTHORIZED", "FORBIDDEN"])("enforces %s", async (reason) => {
  auth.mockRejectedValue(Error(reason));
  const response = await put({ entries });
  expect(response.status).toBe(reason === "UNAUTHORIZED" ? 401 : 403);
  expect(rpc).not.toHaveBeenCalled();
});
