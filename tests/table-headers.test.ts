import { it, expect } from "vitest";
import { parseWorkbook } from "../src/lib/domain";
it("reads each wishlist table by its own headers after columns move", () => {
  const rows = parseWorkbook([
    {
      name: "Tablas",
      values: [
        [
          "Nombre",
          "Precio",
          "Enlace",
          "Prioridad",
          "Proximos",
          "Hype",
          "URL",
          "Prioridad",
        ],
        [
          "Portal 2",
          9.99,
          "https://store.steampowered.com/app/620/",
          2,
          "Next game",
          "Alta",
          "https://www.nintendo.com/us/store/products/test-switch/",
          5,
        ],
      ],
    },
  ]);
  expect(rows).toHaveLength(2);
  expect(rows[0].priority).toBe(2);
  expect(rows[1].priority).toBe(5);
  expect(rows[1].hype).toBe("Alta");
});
