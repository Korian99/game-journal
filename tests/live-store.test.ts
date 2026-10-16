import { it, expect } from "vitest";
import fs from "node:fs";
import { parseNintendo } from "../src/lib/domain";
it.skipIf(!process.env.LIVE_NINTENDO_HTML)(
  "parses the live Nintendo product's price and discount",
  () => {
    const p = parseNintendo(
      fs.readFileSync(process.env.LIVE_NINTENDO_HTML!, "utf8"),
      "https://www.nintendo.com/es-ar/store/products/monster-hunter-stories-2-wings-of-ruin-deluxe-edition-switch/",
    );
    expect(p.currency).toBe("ARS");
    expect(p.price).toBeGreaterThan(0);
    expect(p.regular).toBeGreaterThan(p.price!);
    expect(p.discount).toBeGreaterThan(0);
  },
);
