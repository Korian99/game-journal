import { describe, it, expect } from "vitest";
import {
  parseStoreUrl,
  parseSteam,
  parseNintendo,
  shouldNotify,
  mergeField,
  parseWorkbook,
  makeImportPlan,
} from "../src/lib/domain";
describe("store URLs", () => {
  it("keeps Nintendo regional offers separate", () => {
    expect(
      parseStoreUrl(
        "https://www.nintendo.com/es-ar/store/products/test-switch/",
      ).region,
    ).toBe("AR");
    expect(
      parseStoreUrl("https://www.nintendo.com/us/store/products/test-switch/")
        .region,
    ).toBe("US");
  });
  it("rejects SSRF and malformed lookalike hosts", () => {
    for (const url of [
      "http://127.0.0.1/app/1",
      "https://store.steampowered.com.evil.com/app/1",
      "https://www.nintendo.com@evil.com/us/store/products/test/",
      "https://www.nintendo.com:444/us/store/products/test/",
    ])
      expect(() => parseStoreUrl(url)).toThrow();
  });
  it("canonicalizes Steam identity", () =>
    expect(
      parseStoreUrl("https://store.steampowered.com/app/620/Portal_2/?x=y").key,
    ).toBe("steam:620:AR"));
});
describe("prices", () => {
  it("preserves Steam currency and zero prices", () => {
    const p = parseSteam({
      success: true,
      data: {
        name: "A",
        is_free: false,
        release_date: { coming_soon: false },
        price_overview: {
          currency: "USD",
          initial: 1000,
          final: 0,
          discount_percent: 100,
        },
      },
    });
    expect(p.price).toBe(0);
    expect(p.currency).toBe("USD");
  });
  it("retains paid Early Access prices", () => {
    const p = parseSteam({
      success: true,
      data: {
        name: "A",
        genres: [{ id: "70" }],
        price_overview: {
          currency: "USD",
          initial: 2000,
          final: 1500,
          discount_percent: 25,
        },
      },
    });
    expect(p.status).toBe("early_access");
    expect(p.price).toBe(15);
  });
  it("does not turn missing data into a free game", () =>
    expect(parseSteam({ success: false }).status).toBe("unavailable"));
  it("reads Nintendo product currency and discounted price", () => {
    const p = parseNintendo(
      '<script type="application/ld+json">' +
        JSON.stringify({
          "@type": "Product",
          name: "Test",
          offers: {
            price: 39.99,
            priceCurrency: "USD",
            url: "https://www.nintendo.com/us/store/products/test-switch/",
          },
        }) +
        "</script>",
      "https://www.nintendo.com/us/store/products/test-switch/",
    );
    expect(p.price).toBe(39.99);
    expect(p.currency).toBe("USD");
  });
  it("rejects an unrelated Nintendo product", () =>
    expect(() =>
      parseNintendo(
        '<script type="application/ld+json">' +
          JSON.stringify({
            "@type": "Product",
            name: "Other",
            url: "https://www.nintendo.com/us/store/products/other/",
            offers: { price: 1, priceCurrency: "USD" },
          }) +
          "</script>",
        "https://www.nintendo.com/us/store/products/test-switch/",
      ),
    ).toThrow());
  it("alerts only on new sales or lower comparable prices", () => {
    expect(
      shouldNotify(null, { price: 10, currency: "USD", discount: 20 }),
    ).toBe(false);
    expect(
      shouldNotify(
        { price: 10, currency: "USD", discount: 20 },
        { price: 10, currency: "USD", discount: 20 },
      ),
    ).toBe(false);
    expect(
      shouldNotify(
        { price: 10, currency: "USD", discount: 0 },
        { price: 8, currency: "USD", discount: 20 },
      ),
    ).toBe(true);
    expect(
      shouldNotify(
        { price: 10, currency: "USD", discount: 0 },
        { price: 8, currency: "ARS", discount: 20 },
      ),
    ).toBe(false);
  });
});
describe("reviewed imports", () => {
  it("requires a decision when both sides change", () =>
    expect(mergeField("old", "app", "sheet")).toEqual({
      value: "app",
      conflict: true,
    }));
  it("preserves app-only edits", () =>
    expect(mergeField("old", "app", "old")).toEqual({
      value: "app",
      conflict: false,
    }));
  it("preserves historical periods and rating scales using headers", () => {
    const rows = parseWorkbook([
      {
        name: "<2025",
        values: [
          ["Juego", "Jugue en", "Memorabilidad", "Impresiones", "Consola"],
          ["Test", "2004 - 2008", 7, 10, "GBA Emulator"],
        ],
      },
    ]);
    expect(rows[0].period).toBe("2004 - 2008");
    expect(rows[0].memorability).toBe(7);
    expect(rows[0].impression).toBe("10");
  });
  it("matches reordered rows without duplicating records", () => {
    const incoming = parseWorkbook([
      {
        name: "2025",
        values: [
          ["Juego", "Reseña"],
          ["B", 80],
          ["A", 90],
        ],
      },
    ]);
    const existing = incoming.map((r) => ({
      ...r,
      id: r.title,
      source_key: r.sourceKey,
      source_snapshot: r,
      updated_at: "x",
    }));
    expect(
      makeImportPlan(incoming, existing).every((p) => p.kind === "unchanged"),
    ).toBe(true);
  });
});
