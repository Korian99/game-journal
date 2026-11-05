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
import {
  importConflictLabel,
  importConflictValue,
} from "../src/features/imports/contracts";
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
  it("renders cover conflicts as a label and image URL instead of an object string", () => {
    const incoming = {
      title: "Game",
      cover: { providerUrl: "https://images.artandgungame.com/cover.jpg" },
    };
    expect(importConflictLabel("cover")).toBe("Portada");
    expect(importConflictValue(incoming, "cover")).toBe(
      incoming.cover.providerUrl,
    );
    expect(importConflictValue(incoming, "notes")).toBe("vacío");
  });

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

  it("reads artwork from all four source tabs without confusing the two Tablas columns", () => {
    const rows = parseWorkbook([
      {
        name: "<2025",
        values: [
          ["Juego", "Cover Art URL"],
          ["Old Game", "https://images.artandgungame.com/old.jpg"],
        ],
      },
      {
        name: "2025",
        values: [
          ["Juego", "Cover Art URL"],
          ["Wishlist Game", "https://images.inkl.com/wishlist.jpg"],
        ],
      },
      {
        name: "2026",
        values: [
          ["Juego", "Cover Art URL"],
          ["New Game", "https://cdn.cloudflare.steamstatic.com/new.jpg"],
        ],
      },
      {
        name: "Tablas",
        values: [
          [
            "URL",
            "Nombre",
            "Comprado",
            "Prioridad",
            "URL",
            "Proximos",
            "Cover Art URL (Nombre)",
            "Cover Art URL (Próximos)",
          ],
          [
            "https://store.steampowered.com/app/1/",
            "Wishlist Table",
            "Sí",
            1,
            "https://store.steampowered.com/app/2/",
            "Upcoming Table",
            "https://images.launchbox-app.com/wishlist-table.jpg",
            "https://www.nintendo.com/upcoming-table.jpg",
          ],
        ],
      },
    ]);
    expect(rows.map((row) => row.cover?.providerUrl)).toEqual([
      "https://images.artandgungame.com/old.jpg",
      "https://images.inkl.com/wishlist.jpg",
      "https://cdn.cloudflare.steamstatic.com/new.jpg",
      "https://images.launchbox-app.com/wishlist-table.jpg",
      "https://www.nintendo.com/upcoming-table.jpg",
    ]);
    expect(rows.every((row) => row.cover?.provider === undefined)).toBe(true);
  });

  it("keeps records with blank or unsupported artwork while omitting that artwork", () => {
    const rows = parseWorkbook([
      {
        name: "2026",
        values: [
          ["Juego", "Cover Art URL"],
          ["Blank Art", ""],
          ["Unsupported Art", "https://untrusted.example/image.jpg"],
        ],
      },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.cover)).toEqual([undefined, undefined]);
  });

  it("preserves app overrides on source refresh and reviews simultaneous provider URL changes", () => {
    const [incoming] = parseWorkbook([
      {
        name: "2026",
        values: [
          ["Juego", "Cover Art URL"],
          ["Game", "https://images.artandgungame.com/new.jpg"],
        ],
      },
    ]);
    const baseline = {
      providerUrl: "https://images.artandgungame.com/old.jpg",
    };
    const current = {
      providerUrl: baseline.providerUrl,
      provider: "steam" as const,
      overrideUrl: "https://assets.nintendo.com/manual.jpg",
    };
    const unchangedSheet = makeImportPlan(
      [{ ...incoming, cover: baseline }],
      [
        {
          ...incoming,
          id: "game",
          cover: current,
          sourceSnapshot: { ...incoming, cover: baseline },
        },
      ],
    )[0];
    expect(unchangedSheet.conflicts).not.toContain("cover");
    expect(unchangedSheet.changes.cover).toBeUndefined();

    const changedSheet = makeImportPlan(
      [
        {
          ...incoming,
          cover: { providerUrl: "https://images.artandgungame.com/new.jpg" },
        },
      ],
      [
        {
          ...incoming,
          id: "game",
          cover: current,
          sourceSnapshot: { ...incoming, cover: baseline },
        },
      ],
    )[0];
    expect(changedSheet.kind).toBe("update");
    expect(changedSheet.conflicts).not.toContain("cover");
    expect(changedSheet.changes.cover).toEqual({
      overrideUrl: current.overrideUrl,
      providerUrl: "https://images.artandgungame.com/new.jpg",
    });

    const appChanged = {
      ...current,
      providerUrl: "https://images.artandgungame.com/app.jpg",
    };
    const simultaneousChange = makeImportPlan(
      [incoming],
      [
        {
          ...incoming,
          id: "game",
          cover: appChanged,
          sourceSnapshot: { ...incoming, cover: baseline },
        },
      ],
    )[0];
    expect(simultaneousChange.kind).toBe("conflict");
    expect(simultaneousChange.conflicts).toContain("cover");
  });

  it("does not clear existing artwork when the sheet has no usable cover URL", () => {
    const [incoming] = parseWorkbook([
      {
        name: "2026",
        values: [
          ["Juego", "Cover Art URL"],
          ["Game", ""],
        ],
      },
    ]);
    const current = {
      providerUrl: "https://images.artandgungame.com/current.jpg",
    };
    const plan = makeImportPlan(
      [incoming],
      [{ ...incoming, id: "game", cover: current, sourceSnapshot: incoming }],
    )[0];
    expect(plan.changes.cover).toBeUndefined();
  });

  it("flags conflicting artwork across source rows for the same game identity", () => {
    const rows = parseWorkbook([
      {
        name: "<2025",
        values: [
          ["Juego", "Cover Art URL"],
          ["Same Game", "https://images.artandgungame.com/old.jpg"],
        ],
      },
      {
        name: "2026",
        values: [
          ["Juego", "Cover Art URL"],
          ["Same Game", "https://images.inkl.com/new.jpg"],
        ],
      },
    ]);
    const existing = rows.map((row, index) => ({
      ...row,
      id: `record-${index}`,
      gameId: "same-game-identity",
      source_key: row.sourceKey,
      cover: { providerUrl: "https://images.artandgungame.com/old.jpg" },
      sourceSnapshot: {
        ...row,
        cover: { providerUrl: "https://images.artandgungame.com/old.jpg" },
      },
    }));
    expect(
      makeImportPlan(rows, existing).map((item) => item.conflicts),
    ).toEqual([["cover"], ["cover"]]);
  });

  it("plans one game-level artwork update for same-URL playthrough rows", () => {
    const rows = parseWorkbook([
      {
        name: "<2025",
        values: [
          ["Juego", "Cover Art URL"],
          ["Same Game", "https://images.artandgungame.com/new.jpg"],
        ],
      },
      {
        name: "2026",
        values: [
          ["Juego", "Cover Art URL"],
          ["Same Game", "https://images.artandgungame.com/new.jpg"],
        ],
      },
    ]);
    const previous = {
      providerUrl: "https://images.artandgungame.com/old.jpg",
    };
    const existing = rows.map((row, index) => ({
      ...row,
      id: `record-${index}`,
      gameId: "same-game-identity",
      source_key: row.sourceKey,
      cover: previous,
      sourceSnapshot: { ...row, cover: previous },
    }));
    const plans = makeImportPlan(rows, existing);
    expect(plans[0].changes.cover).toEqual(rows[0].cover);
    expect(plans[1].changes.cover).toBeUndefined();
    expect(plans[1].kind).toBe("unchanged");
  });

  it("keeps the artwork update when an earlier row already matches its baseline", () => {
    const rows = parseWorkbook([
      {
        name: "<2025",
        values: [
          ["Juego", "Cover Art URL"],
          ["Same Game", "https://images.artandgungame.com/new.jpg"],
        ],
      },
      {
        name: "2026",
        values: [
          ["Juego", "Cover Art URL"],
          ["Same Game", "https://images.artandgungame.com/new.jpg"],
        ],
      },
    ]);
    const existing = rows.map((row, index) => ({
      ...row,
      id: `record-${index}`,
      gameId: "same-game-identity",
      source_key: row.sourceKey,
      cover: { providerUrl: "https://images.artandgungame.com/old.jpg" },
      sourceSnapshot: {
        ...row,
        cover: {
          providerUrl:
            index === 0
              ? row.cover?.providerUrl
              : "https://images.artandgungame.com/old.jpg",
        },
      },
    }));
    const plans = makeImportPlan(rows, existing);
    expect(plans[0].changes.cover).toBeUndefined();
    expect(plans[1].changes.cover).toEqual(rows[1].cover);
  });
});

describe("store titles", () => {
  it("normalizes a verified Steam title even when there is no current price", () => {
    expect(
      parseSteam({ success: true, data: { name: "  Portal \n 2  " } }),
    ).toMatchObject({ name: "Portal 2", price: null });
    expect(
      parseSteam({ success: true, data: { name: { unexpected: "object" } } })
        .name,
    ).toBeUndefined();
    expect(
      parseSteam({ success: true, data: { name: " \n " } }).name,
    ).toBeUndefined();
    expect(
      parseSteam({ success: true, data: { name: "a".repeat(301) } }).name,
    ).toBeUndefined();
  });
  it("retains a matching Nintendo product title without inventing a price", () => {
    const url = "https://www.nintendo.com/es-ar/store/products/test-switch/";
    const html =
      '<script type="application/ld+json">' +
      JSON.stringify({
        "@type": "Product",
        url,
        name: "  Nintendo \n Title  ",
      }) +
      "</script>";
    expect(parseNintendo(html, url)).toMatchObject({
      name: "Nintendo Title",
      status: "unavailable",
      price: null,
      currency: null,
    });
  });
  it("rejects missing or unrelated Nintendo metadata instead of accepting page chrome", () => {
    const url = "https://www.nintendo.com/es-ar/store/products/test-switch/";
    for (const node of [
      { "@type": "Product", url, name: " " },
      {
        "@type": "Product",
        url: url.replace("test-switch", "other-switch"),
        name: "Other game",
      },
    ]) {
      expect(() =>
        parseNintendo(
          '<script type="application/ld+json">' +
            JSON.stringify(node) +
            "</script>",
          url,
        ),
      ).toThrow();
    }
  });
});
