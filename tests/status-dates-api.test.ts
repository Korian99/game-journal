import { afterEach, beforeEach, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", async () => {
  const { errorResponse } = await import("../src/lib/api-errors");
  return { authorized: auth, apiError: errorResponse };
});
import { POST } from "../src/app/api/records/route";
import { emptyRecord, type Status } from "../src/lib/types";

const original = {
  ...emptyRecord,
  id: "20000000-0000-4000-8000-000000000001",
  gameId: "30000000-0000-4000-8000-000000000001",
  title: "Date transition fixture",
  status: "wishlist" as Status,
  updated_at: "2026-10-21T10:00:00Z",
};
let existing: unknown[];
const rpc = vi.fn(async (name: string, args?: { input?: unknown }) => {
  if (name === "list_records") return { data: existing, error: null };
  if (name === "save_record_result")
    return {
      data: { id: original.id, gameId: original.gameId, record: args?.input },
      error: null,
    };
  throw Error("Unexpected RPC " + name);
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  // 23 October in UTC is still 22 October in Argentina.
  vi.setSystemTime(new Date("2026-10-23T01:30:00Z"));
  existing = [original];
  auth.mockResolvedValue({
    db: {
      rpc,
      from: () => ({ select: async () => ({ data: [], error: null }) }),
    },
  });
});
afterEach(() => vi.useRealTimers());
async function save(patch: Record<string, unknown>) {
  return POST(
    new Request("http://fixture/api/records", {
      method: "POST",
      body: JSON.stringify({ ...original, ...patch }),
    }),
  );
}
function expectSaved(dates: { started: string; finished: string }) {
  expect(rpc).toHaveBeenCalledWith(
    "save_record_result",
    expect.objectContaining({
      input: expect.objectContaining(dates),
      record_id: original.id,
      expected: original.updated_at,
    }),
  );
}
it.each(["", null, "   "])(
  "dates the transition to playing when started is %j",
  async (started) => {
    const response = await save({ status: "playing", started });
    expect(response.status).toBe(200);
    expectSaved({ started: "2026-10-22", finished: "" });
  },
);
it.each(["", null, "   "])(
  "dates the transition to completed when finished is %j",
  async (finished) => {
    existing = [{ ...original, status: "playing", started: "2026-10-01" }];
    const response = await save({
      status: "completed",
      started: "2026-10-01",
      finished,
    });
    expect(response.status).toBe(200);
    expectSaved({ started: "2026-10-01", finished: "2026-10-22" });
    expect((await response.json()).record.finished).toBe("2026-10-22");
  },
);
it("does not invent a start date when only completing a game", async () => {
  const response = await save({ status: "completed" });
  expect(response.status).toBe(200);
  expectSaved({ started: "", finished: "2026-10-22" });
});
it("preserves existing dates when resuming", async () => {
  existing = [{ ...original, status: "paused", started: "01/10/2026" }];
  expect(
    (await save({ status: "playing", started: "01/10/2026" })).status,
  ).toBe(200);
  expectSaved({ started: "01/10/2026", finished: "" });
});
it("preserves an explicitly supplied finish date", async () => {
  expect(
    (await save({ status: "completed", finished: "15/10/2026" })).status,
  ).toBe(200);
  expectSaved({ started: "", finished: "15/10/2026" });
});
it.each(["playing", "completed"] as const)(
  "does not backfill unchanged %s records",
  async (status) => {
    existing = [{ ...original, status }];
    expect((await save({ status, notes: "Review edit" })).status).toBe(200);
    expectSaved({ started: "", finished: "" });
  },
);
it("does not fill dates for a paused transition", async () => {
  expect((await save({ status: "paused" })).status).toBe(200);
  expectSaved({ started: "", finished: "" });
});
it("accepts existing null dates without breaking the transition", async () => {
  existing = [{ ...original, started: null, finished: null }];
  expect(
    (await save({ status: "playing", started: null, finished: null })).status,
  ).toBe(200);
  expectSaved({ started: "2026-10-22", finished: "" });
});
it("does not assign today's dates when creating a historical entry", async () => {
  existing = [];
  const response = await save({
    id: undefined,
    status: "completed",
    period: "2020",
  });
  expect(response.status).toBe(200);
  expect(rpc).toHaveBeenCalledWith(
    "save_record_result",
    expect.objectContaining({
      input: expect.objectContaining({ started: "", finished: "" }),
      record_id: null,
    }),
  );
});

it("derives the period after automatic status dates are filled", async () => {
  expect((await save({ status: "playing" })).status).toBe(200);
  expect(rpc).toHaveBeenCalledWith(
    "save_record_result",
    expect.objectContaining({
      input: expect.objectContaining({ started: "2026-10-22", period: "2026" }),
    }),
  );
});
it("saves cross-year play periods from explicit dates", async () => {
  expect(
    (
      await save({
        started: "2025-12-31",
        finished: "01/01/2026",
        period: "2020",
      })
    ).status,
  ).toBe(200);
  expect(rpc).toHaveBeenCalledWith(
    "save_record_result",
    expect.objectContaining({
      input: expect.objectContaining({ period: "2025-2026" }),
    }),
  );
});
it("keeps an approximate period when only editing a review", async () => {
  existing = [{ ...original, started: "2025-01-01", period: "2024-2025" }];
  expect(
    (
      await save({
        started: "2025-01-01",
        period: "2024-2025",
        notes: "Edited review",
      })
    ).status,
  ).toBe(200);
  expect(rpc).toHaveBeenCalledWith(
    "save_record_result",
    expect.objectContaining({
      input: expect.objectContaining({ period: "2024-2025" }),
    }),
  );
});

it("undo restores exact historical date, status, and period values while retaining revision checking", async () => {
  existing = [
    {
      ...original,
      status: "completed",
      started: "2025-01-01",
      finished: "2026-01-01",
      period: "2025-2026",
    },
  ];
  const response = await POST(
    new Request("http://fixture/api/records", {
      method: "POST",
      body: JSON.stringify({
        ...original,
        status: "playing",
        started: "",
        finished: "",
        period: "2014-2018",
        intent: "undo",
      }),
    }),
  );
  expect(response.status).toBe(200);
  expect(rpc).toHaveBeenCalledWith(
    "save_record_result",
    expect.objectContaining({
      input: expect.objectContaining({
        status: "playing",
        started: "",
        finished: "",
        period: "2014-2018",
      }),
      expected: original.updated_at,
    }),
  );
});
