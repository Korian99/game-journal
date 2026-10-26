import { expect, it } from "vitest";
import * as display from "../src/lib/offers/wishlist-display";
import type { Offer } from "../src/lib/types";

it("shows the platforms from added store pages and deduplicates regional offers", () => {
  expect(
    display.wishlistPlatforms(
      {
        pages: [
          "https://www.nintendo.com/es-ar/store/products/game-switch/",
          "https://store.epicgames.com/es-ES/p/alan-wake-2",
        ],
      },
      [
        { url: "https://store.steampowered.com/app/620/" },
        { url: "https://store.steampowered.com/app/620/?cc=US" },
        { url: "https://www.nintendo.com/us/store/products/game-switch-2/" },
      ],
    ),
  ).toEqual(["PC", "Switch", "Switch 2"]);
});
it("identifies Nintendo archive consoles without guessing from arbitrary reference pages", () => {
  expect(
    display.wishlistPlatforms(
      {
        pages: [
          "https://www.nintendo.com/en-gb/Games/Nintendo-DS/Pokemon-White-Version-272486.html",
          "https://www.nintendo.com/en-gb/Games/Nintendo-3DS-games/Pokemon-X-123.html",
          "https://www.nintendo.com/es-ar/store/products/unknown-product/",
          "https://example.com/game-switch/",
          "https://store.steampowered.com.evil.example/app/620/",
        ],
      },
      [],
    ),
  ).toEqual(["Nintendo DS", "Nintendo 3DS"]);
  expect(display.wishlistPlatforms({ pages: [] }, [])).toEqual([]);
  expect(display.wishlistPlatforms({ pages: ["not a url"] }, [])).toEqual([]);
});
it("highlights active discounts, including one discounted offer among several", () => {
  const quote = {
    price: 20,
    discount: 25,
    status: "available",
    error: null,
  } as Offer;
  expect(display.hasActiveDiscount([quote])).toBe(true);
  expect(
    display.hasActiveDiscount([
      { ...quote, discount: 0 },
      { ...quote, status: "early_access" },
    ]),
  ).toBe(true);
  expect(
    display.hasActiveDiscount([
      { ...quote, price: 0, discount: 100, status: "free" },
    ]),
  ).toBe(true);
  expect(display.hasActiveDiscount([{ ...quote, status: "upcoming" }])).toBe(
    true,
  );
});
it("does not highlight missing prices, stale failed quotes, or unavailable offers", () => {
  const quote = {
    price: 20,
    discount: 25,
    status: "available",
    error: null,
  } as Offer;
  for (const change of [
    { price: null },
    { price: NaN },
    { price: -1 },
    { discount: 0 },
    { discount: 101 },
    { status: "unavailable" },
    { status: "error" },
    { error: "Failed to fetch" },
  ]) {
    expect(
      display.hasActiveDiscount([{ ...quote, ...change }]),
      JSON.stringify(change),
    ).toBe(false);
  }
  expect(display.hasActiveDiscount([])).toBe(false);
});
