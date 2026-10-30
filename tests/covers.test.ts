import { expect, it } from "vitest";
import {
  coverSchema,
  effectiveCoverUrl,
  mergeProviderCover,
} from "../src/lib/covers";
import { recordSchema } from "../src/lib/validation";
import { journalEntrySchema } from "../src/lib/contracts";
import { emptyRecord } from "../src/lib/types";

it.each([
  "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/620/header.jpg",
  "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/620/capsule.jpg",
  "https://assets.nintendo.com/image/upload/example.jpg",
])("accepts approved HTTPS image host %s", (providerUrl) => {
  expect(
    coverSchema.parse({ providerUrl, provider: "steam" }).providerUrl,
  ).toBe(providerUrl);
});

it.each([
  "http://assets.nintendo.com/image.jpg",
  "https://assets.nintendo.com.evil.test/image.jpg",
  "https://user:pass@assets.nintendo.com/image.jpg",
  "https://assets.nintendo.com:444/image.jpg",
  "https://example.org/image.jpg",
  "x".repeat(2001),
])("rejects unsupported or oversized image URL %s", (url) => {
  expect(coverSchema.safeParse({ overrideUrl: url }).success).toBe(false);
});

it("bounds the normalized URL as well as the submitted text", () => {
  const source = "https://assets.nintendo.com/" + "é".repeat(330);
  expect(source.length).toBeLessThanOrEqual(2000);
  expect(coverSchema.safeParse({ providerUrl: source }).success).toBe(false);
});

it("allows override-only covers and resolves the override first", () => {
  const cover = coverSchema.parse({
    overrideUrl: "https://assets.nintendo.com/image/upload/manual.jpg",
  });
  expect(effectiveCoverUrl(cover)).toBe(cover.overrideUrl);
});

it("treats missing and empty covers as no image", () => {
  expect(effectiveCoverUrl(undefined)).toBeUndefined();
  expect(effectiveCoverUrl(coverSchema.parse({}))).toBeUndefined();
  expect(
    effectiveCoverUrl(coverSchema.parse({ overrideUrl: "" })),
  ).toBeUndefined();
});

it("keeps validated game cover metadata in explicit record contracts", () => {
  const cover = {
    providerUrl:
      "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/620/header.jpg",
    provider: "steam",
  } as const;
  expect(
    recordSchema.parse({ ...emptyRecord, title: "Portal 2", cover }).cover,
  ).toEqual(cover);
  expect(
    journalEntrySchema.parse({ title: "Portal 2", status: "completed", cover })
      .cover,
  ).toEqual(cover);
});

it("preserves existing provider art and manual override during provider refresh", () => {
  const existing = coverSchema.parse({
    provider: "steam",
    providerUrl:
      "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/620/header.jpg",
    overrideUrl: "https://assets.nintendo.com/image/upload/manual.jpg",
  });
  const incoming = coverSchema.parse({
    provider: "nintendo",
    providerUrl: "https://assets.nintendo.com/image/upload/new.jpg",
  });
  expect(mergeProviderCover(existing, incoming)).toEqual(existing);
  expect(effectiveCoverUrl(mergeProviderCover(existing, incoming))).toBe(
    existing.overrideUrl,
  );
});

it("uses incoming provider artwork only when the game has no cover", () => {
  const incoming = coverSchema.parse({
    provider: "nintendo",
    providerUrl: "https://assets.nintendo.com/image/upload/new.jpg",
  });
  expect(mergeProviderCover(undefined, incoming)).toEqual(incoming);
});

it("keeps an override-only cover and fills its missing provider fallback", () => {
  const current = coverSchema.parse({
    overrideUrl: "https://assets.nintendo.com/image/upload/manual.jpg",
  });
  const incoming = coverSchema.parse({
    provider: "steam",
    providerUrl:
      "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/620/header.jpg",
  });
  expect(mergeProviderCover(current, incoming)).toEqual({
    ...current,
    ...incoming,
  });
});

it("never imports a provider-supplied manual override", () => {
  const incoming = coverSchema.parse({
    provider: "nintendo",
    providerUrl: "https://assets.nintendo.com/image/upload/new.jpg",
    overrideUrl:
      "https://assets.nintendo.com/image/upload/untrusted-manual.jpg",
  });
  expect(mergeProviderCover(undefined, incoming)).toEqual({
    provider: "nintendo",
    providerUrl: "https://assets.nintendo.com/image/upload/new.jpg",
  });
});
