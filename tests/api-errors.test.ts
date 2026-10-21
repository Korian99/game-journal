import { expect, it, vi } from "vitest";
import { z } from "zod";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ serverClient: vi.fn() }));
import { apiError } from "../src/lib/auth";
it.each([
  ["UNAUTHORIZED", 401, "UNAUTHORIZED"],
  ["FORBIDDEN", 403, "FORBIDDEN"],
  ["CONFLICT: cambió", 409, "CONFLICT"],
  ["NOT_FOUND", 404, "NOT_FOUND"],
])("classifies %s", async (message, status, code) => {
  const response = apiError(new Error(message));
  expect(response.status).toBe(status);
  expect(await response.json()).toMatchObject({
    code,
    error: expect.any(String),
  });
});
it("returns actionable field validation errors", async () => {
  const parsed = z
    .object({ title: z.string().min(1) })
    .safeParse({ title: "" });
  const response = apiError(parsed.error);
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({
    code: "VALIDATION",
    fieldErrors: { title: expect.any(String) },
  });
});
