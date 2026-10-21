import { expect, it } from "vitest";
import * as validation from "../src/lib/validation";
const contracts = validation as unknown as Record<
  string,
  { safeParse: (value: unknown) => { success: boolean } }
>;
it("validates successful record responses instead of accepting malformed collections", () => {
  expect(contracts.recordsResponseSchema).toBeDefined();
  if (!contracts.recordsResponseSchema) return;
  expect(
    contracts.recordsResponseSchema.safeParse({
      records: "invalid",
      member: null,
    }).success,
  ).toBe(false);
});
it("rejects incomplete price quotes instead of displaying a fabricated zero", () => {
  expect(contracts.offersSchema).toBeDefined();
  if (!contracts.offersSchema) return;
  expect(
    contracts.offersSchema.safeParse([{ id: "offer", price: "free" }]).success,
  ).toBe(false);
});
