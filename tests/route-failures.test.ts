import { beforeEach, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", async () => {
  const { errorResponse } = await import("../src/lib/api-errors");
  return { authorized: auth, apiError: errorResponse };
});
import { GET, PUT, POST } from "../src/app/api/notification-settings/route";
import { PATCH } from "../src/app/api/offers/route";

const failure = { code: "08006", message: "Connection lost" };
let result: { data: unknown; error: typeof failure | null };
const request = (body: unknown) =>
  new Request("http://fixture/api", {
    method: "POST",
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  result = { data: null, error: failure };
  const query = {
    select: () => query,
    eq: () => query,
    update: () => query,
    single: async () => result,
    maybeSingle: async () => result,
  };
  auth.mockResolvedValue({ db: { from: () => query }, user: { id: "owner" } });
});
it.each([
  ["preferences read", () => GET()],
  [
    "preferences save",
    () => PUT(request({ discounts: true, targets: false, releases: true })),
  ],
  [
    "device status",
    () =>
      POST(
        request({
          action: "status",
          endpoint: "https://fcm.googleapis.com/test",
        }),
      ),
  ],
  [
    "offer update",
    () =>
      PATCH(
        request({ id: "10000000-0000-4000-8000-000000000001", watched: true }),
      ),
  ],
] as const)(
  "classifies a database outage during %s as temporary",
  async (_label, call) => {
    const response = await call();
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      code: "TEMPORARY",
      error: expect.any(String),
    });
  },
);
it("distinguishes an absent offer from a database outage", async () => {
  result = { data: null, error: null };
  const response = await PATCH(
    request({ id: "10000000-0000-4000-8000-000000000001", watched: true }),
  );
  expect(response.status).toBe(404);
  expect(await response.json()).toMatchObject({ code: "NOT_FOUND" });
});
