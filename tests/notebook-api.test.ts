import { beforeEach, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", async () => ({
  authorized: auth,
  apiError: (await import("../src/lib/api-errors")).errorResponse,
}));
import { GET, PUT } from "../src/app/api/notebook/route";

const owner = "10000000-0000-4000-8000-000000000001";
const maybeSingle = vi.fn(),
  single = vi.fn(),
  eq = vi.fn(),
  upsert = vi.fn(),
  from = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  maybeSingle.mockResolvedValue({ data: null, error: null });
  single.mockResolvedValue({ data: { content: "Saved" }, error: null });
  eq.mockReturnValue({ maybeSingle });
  upsert.mockReturnValue({ select: () => ({ single }) });
  from.mockReturnValue({ select: () => ({ eq }), upsert });
  auth.mockResolvedValue({ user: { id: owner }, db: { from } });
});
const put = (body: unknown) =>
  PUT(
    new Request("http://fixture/api/notebook", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  );

it("loads only the caller's note and returns an empty field when none is saved", async () => {
  let response = await GET();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ content: "" });
  expect(from).toHaveBeenCalledWith("notebooks");
  expect(eq).toHaveBeenCalledWith("owner_id", owner);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  maybeSingle.mockResolvedValue({
    data: { content: "Personal note" },
    error: null,
  });
  response = await GET();
  expect(await response.json()).toEqual({ content: "Personal note" });
});

it("saves exact plain text under the authenticated owner and accepts clearing it", async () => {
  const content = "  First line\n<b>Not HTML</b> 🙂\t ";
  single.mockResolvedValue({ data: { content }, error: null });
  const response = await put({ content });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ content });
  expect(upsert).toHaveBeenCalledWith(
    { owner_id: owner, content },
    { onConflict: "owner_id" },
  );
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  single.mockResolvedValue({ data: { content: "" }, error: null });
  expect((await put({ content: "" })).status).toBe(200);
  expect(upsert).toHaveBeenLastCalledWith(
    { owner_id: owner, content: "" },
    { onConflict: "owner_id" },
  );
});

it("rejects owner injection and invalid text before writing", async () => {
  for (const body of [
    {},
    null,
    { content: null },
    { content: 12 },
    { content: "Note", owner_id: owner },
    { content: "x".repeat(100001) },
  ]) {
    expect((await put(body)).status).toBe(400);
  }
  expect(
    (
      await PUT(
        new Request("http://fixture/api/notebook", {
          method: "PUT",
          body: "{",
        }),
      )
    ).status,
  ).toBe(400);
  expect(upsert).not.toHaveBeenCalled();
});

it.each(["UNAUTHORIZED", "FORBIDDEN"])(
  "enforces %s for load and save",
  async (reason) => {
    auth.mockRejectedValue(Error(reason));
    const expected = reason === "UNAUTHORIZED" ? 401 : 403;
    expect((await GET()).status).toBe(expected);
    expect((await put({ content: "Private" })).status).toBe(expected);
    expect(from).not.toHaveBeenCalled();
  },
);

it("reports database outages without returning empty success", async () => {
  maybeSingle.mockResolvedValue({
    data: null,
    error: { code: "08006", message: "Unavailable" },
  });
  single.mockResolvedValue({
    data: null,
    error: { code: "08006", message: "Unavailable" },
  });
  expect((await GET()).status).toBe(503);
  expect((await put({ content: "Keep this draft" })).status).toBe(503);
});

it("refuses malformed database responses", async () => {
  maybeSingle.mockResolvedValue({ data: { content: null }, error: null });
  single.mockResolvedValue({ data: {}, error: null });
  expect((await GET()).status).toBe(503);
  expect((await put({ content: "Keep this draft" })).status).toBe(503);
});
