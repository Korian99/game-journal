import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { emptyRecord } from "../src/lib/types";

const auth = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/auth", () => ({
  authorized: auth,
  apiError: (error: Error) =>
    Response.json({ error: error.message }, { status: 400 }),
}));
import { POST } from "../src/app/api/records/route";

let rpc: ReturnType<typeof vi.fn>;
beforeEach(() => {
  rpc = vi
    .fn()
    .mockResolvedValueOnce({ data: [], error: null })
    .mockResolvedValueOnce({
      data: { id: "record-id", gameId: "game-id" },
      error: null,
    });
  auth.mockResolvedValue({ db: { rpc } });
});
afterEach(() => vi.clearAllMocks());

it("passes validated cover metadata to the canonical save RPC", async () => {
  const cover = {
    provider: "steam",
    providerUrl:
      "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/620/header.jpg",
  };
  const response = await POST(
    new Request("http://fixture/api/records", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...emptyRecord,
        title: "Portal 2",
        cover,
        allowDuplicate: true,
      }),
    }),
  );
  expect(response.status).toBe(200);
  expect(rpc.mock.calls[1][0]).toBe("save_record_result");
  expect(rpc.mock.calls[1][1].input.cover).toEqual(cover);
});

it("rejects unsupported image hosts before save", async () => {
  const response = await POST(
    new Request("http://fixture/api/records", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...emptyRecord,
        title: "Portal 2",
        cover: { providerUrl: "https://images.example.org/cover.jpg" },
        allowDuplicate: true,
      }),
    }),
  );
  expect(response.status).toBe(400);
  expect(rpc).not.toHaveBeenCalled();
});
