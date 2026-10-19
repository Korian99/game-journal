import { expect, it } from "vitest";
import { recordSchema } from "../src/lib/validation";
import { emptyRecord } from "../src/lib/types";
const record = { ...emptyRecord, title: "Example game" };
it("keeps optional pages while creating a game, including official reference pages", () => {
  const pages = [
    "https://store.steampowered.com/app/620/?cc=US",
    "https://www.nintendo.com/us/store/products/example-switch/",
    "https://example.com/upcoming-game",
  ];
  expect(recordSchema.parse({ ...record, pages }).pages).toEqual(pages);
  expect(recordSchema.parse(record)).not.toHaveProperty("pages");
});
it("normalizes and deduplicates pages before saving", () => {
  expect(
    recordSchema.parse({
      ...record,
      pages: [" https://EXAMPLE.com ", "https://example.com/"],
    }).pages,
  ).toEqual(["https://example.com/"]);
});
it("rejects unsafe pages and limits the number of pages", () => {
  for (const page of [
    "javascript:alert(1)",
    "http://example.com/game",
    "https://user:password@example.com/game",
    "not a URL",
  ]) {
    expect(recordSchema.safeParse({ ...record, pages: [page] }).success).toBe(
      false,
    );
  }
  expect(
    recordSchema.safeParse({
      ...record,
      pages: Array.from({ length: 21 }, (_, i) => "https://example.com/" + i),
    }).success,
  ).toBe(false);
});
