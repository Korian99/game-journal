import { it, expect } from "vitest";
import { parseNintendo } from "../src/lib/domain";
it("reads Nintendo's serialized product cache without mixing related products", () => {
  const url = "https://www.nintendo.com/es-ar/store/products/test-switch/";
  const product = {
    "@type": "Product",
    name: "Test",
    offers: { url, price: 30, priceCurrency: "ARS" },
  };
  const cache = {
    related: {
      urlKey: "test-switch-deluxe",
      'prices({"personalized":false})': {
        currency: "ARS",
        regularPrice: 999,
        finalPrice: 30,
      },
    },
    requested: {
      urlKey: "test-switch",
      'prices({"personalized":false})': {
        currency: "ARS",
        regularPrice: 100,
        finalPrice: 30,
      },
    },
  };
  const html =
    '<script type="application/ld+json">' +
    JSON.stringify(product) +
    '</script><script id="__NEXT_DATA__" type="application/json">' +
    JSON.stringify({ props: { pageProps: { cache: JSON.stringify(cache) } } }) +
    "</script>";
  const price = parseNintendo(html, url);
  expect(price.regular).toBe(100);
  expect(price.discount).toBe(70);
});
