import { expect, it } from "vitest";
import { recordSchema } from "../src/lib/validation";
import { emptyRecord } from "../src/lib/types";
import { parseWorkbook } from "../src/lib/domain";

it("saves numeric and named wishlist priorities without dropping labels", () => {
  const record = { ...emptyRecord, title: "Example game", status: "wishlist" };
  expect(recordSchema.parse({ ...record, priority: "Migui" }).priority).toBe(
    "Migui",
  );
  expect(recordSchema.parse({ ...record, priority: "4" }).priority).toBe(4);
  expect(recordSchema.parse({ ...record, priority: "" }).priority).toBeNull();
  expect(recordSchema.safeParse({ ...record, priority: 101 }).success).toBe(
    false,
  );
  expect(recordSchema.safeParse({ ...record, priority: "101" }).success).toBe(
    false,
  );
});

it("imports priorities and links from the two side-by-side tables in spreadsheet order", () => {
  const records = parseWorkbook([
    {
      name: "Tablas",
      values: [
        [
          "Prioridad",
          "URL",
          "Nombre",
          "Precio",
          "Comprado",
          "Hs. Estimadas",
          "Fecha de Salida",
          "URL",
          "Proximos",
          "Release Info",
          "Hype",
        ],
        [
          "Migui",
          "https://store.steampowered.com/app/620/",
          "Portal 2",
          9.99,
          "Si",
          "6 - 8 - 12",
          "",
          "https://store.steampowered.com/app/400/",
          "Portal",
          "Soon",
          "Alta",
        ],
      ],
    },
  ]);
  expect(records).toHaveLength(2);
  expect(records[0]).toMatchObject({
    priority: "Migui",
    ownership: "Si",
    estimated: "6 - 8 - 12",
    links: ["https://store.steampowered.com/app/620/"],
  });
  expect(records[1]).toMatchObject({
    priority: null,
    hype: "Alta",
    links: ["https://store.steampowered.com/app/400/"],
  });
});
