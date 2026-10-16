import { describe, it, expect } from "vitest";
import {
  parseStoreUrl,
  parseNintendo,
  parseWorkbook,
  makeImportPlan,
} from "../src/lib/domain";
describe("regional identity and import links", () => {
  it("retains an explicit Steam country in canonical URLs", () => {
    const p = parseStoreUrl("https://store.steampowered.com/app/620/?cc=US");
    expect(p.region).toBe("US");
    expect(parseStoreUrl(p.url).key).toBe("steam:620:US");
  });
  it("does not mistake a Nintendo slug prefix for the requested product", () => {
    expect(() =>
      parseNintendo(
        '<script type="application/ld+json">' +
          JSON.stringify({
            "@type": "Product",
            url: "https://www.nintendo.com/us/store/products/test-switch-deluxe/",
            offers: { price: 10, priceCurrency: "USD" },
          }) +
          "</script>",
        "https://www.nintendo.com/us/store/products/test-switch/",
      ),
    ).toThrow();
  });
  it("plans newly added store links even when journal fields stay unchanged", () => {
    const incoming = parseWorkbook([
      {
        name: "Tablas",
        values: [
          ["Nombre", "Link"],
          ["Portal 2", "https://store.steampowered.com/app/620/"],
        ],
      },
    ]);
    const old = {
      ...incoming[0],
      id: "fixture",
      sourceSnapshot: { ...incoming[0], links: [] },
    };
    const plan = makeImportPlan(incoming, [old])[0];
    expect(plan.kind).toBe("update");
    expect(plan.changes.links).toEqual(incoming[0].links);
  });
});
