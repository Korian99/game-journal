import { afterEach, expect, it, vi } from "vitest";
import { apiRequest } from "../src/lib/api-client";
afterEach(() => vi.unstubAllGlobals());
it("retains the HTTP status and error code for revision conflicts", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json(
        { error: "Cambió en otro dispositivo", code: "CONFLICT" },
        { status: 409 },
      ),
    ),
  );
  await expect(apiRequest("/api/records", "POST", {})).rejects.toMatchObject({
    status: 409,
    code: "CONFLICT",
    message: "Cambió en otro dispositivo",
  });
});
it("reports an HTML service failure as a temporary API failure", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () => new Response("<html>Unavailable</html>", { status: 503 }),
    ),
  );
  await expect(apiRequest("/api/records")).rejects.toMatchObject({
    status: 503,
    code: "TEMPORARY",
  });
});
it("distinguishes a malformed successful response from an empty collection", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("not json", { status: 200 })),
  );
  await expect(apiRequest("/api/records")).rejects.toMatchObject({
    code: "INVALID_RESPONSE",
  });
});
it("classifies loss of connectivity without claiming a save succeeded", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }),
  );
  await expect(apiRequest("/api/records")).rejects.toMatchObject({
    status: 0,
    code: "NETWORK",
  });
});
