import { beforeEach, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";
import { emptyRecord, type JournalRecord } from "../src/lib/types";
const auth = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", () => ({
  authorized: auth,
  apiError: (e: Error) =>
    Response.json(
      { error: e.message },
      { status: e.message === "UNAUTHORIZED" ? 401 : 400 },
    ),
}));
import { GET } from "../src/app/api/export/route";
const owner = "test-owner";
const steam = "https://store.steampowered.com/app/620/?cc=AR";
const ref = "https://example.com/coming-soon";
let records: (JournalRecord & { gameId: string })[];
let tables: Record<string, any[]>;
let errors: Record<string, string>;
let queries: { table: string; owner?: string; after?: string }[];
let cap: number;
function builder(table: string) {
  const query: { table: string; owner?: string; after?: string } = { table };
  queries.push(query);
  const b: any = {
    select: () => b,
    eq: (field: string, value: string) => {
      if (field === "owner_id") query.owner = value;
      return b;
    },
    order: () => b,
    limit: () => b,
    gt: (_: string, value: string) => {
      query.after = value;
      return b;
    },
    then: (resolve: any) =>
      resolve({
        data: (tables[table] ?? [])
          .filter(
            (r) =>
              (!query.owner || r.owner_id === query.owner) &&
              (!query.after || r.id > query.after),
          )
          .sort((a, b) => a.id.localeCompare(b.id))
          .slice(0, cap),
        error: errors[table] ? { message: errors[table] } : null,
      }),
  };
  return b;
}
beforeEach(() => {
  vi.clearAllMocks();
  queries = [];
  errors = {};
  cap = 500;
  records = (
    [
      "playing",
      "completed",
      "paused",
      "abandoned",
      "remembered",
      "wishlist",
      "upcoming",
    ] as const
  ).map((status, i) => ({
    ...emptyRecord,
    id: "entry-" + i,
    gameId: "game-" + i,
    title: i === 0 ? "=2+2" : "Game " + i,
    status,
    started: "2026-02-01",
    finished: i === 1 ? "2026-02-03" : "",
    period: "2026",
    device: "PC",
    platforms: "PC; Nintendo Switch",
    hours: i === 0 ? 0 : null,
    estimated: "8 - 12 - 20",
    rating: i === 0 ? 0 : null,
    memorability: 7,
    priority: "Migui",
    hype: "Hyper",
    reason: "Una explicación",
    notes: 'Reseña con ñ, comillas " y\nsalto de línea',
    focus: "Ambos",
    replay: "Sí",
    ownership: "En Familia",
    pages: i === 0 ? [steam, ref] : [],
    sourceKey: "source-" + i,
    sourceSnapshot: { raw: { original: "Keep this" } },
  }));
  records.push({ ...records[0], id: "replay-entry", pages: [] });
  tables = {
    offers: [
      {
        id: "offer-0",
        owner_id: owner,
        game_id: "game-0",
        url: steam,
        store: "steam",
        region: "AR",
        currency: "USD",
        price: 0,
        regular_price: 10,
        discount: 100,
        status: "free",
        checked_at: "2026-02-03T15:07:00Z",
        watched: true,
        target_price: 0,
        error: null,
      },
    ],
    price_history: [
      {
        id: "history-0",
        owner_id: owner,
        offer_id: "offer-0",
        price: 0,
        currency: "USD",
        discount: 100,
        created_at: "2026-02-03T15:07:00Z",
      },
    ],
  };
  auth.mockResolvedValue({
    user: { id: owner },
    db: {
      rpc: vi.fn(async () => ({ data: records, error: null })),
      from: builder,
    },
  });
});
const request = (format: string) =>
  new Request("http://localhost/api/export?format=" + format + "&year=2099");
async function workbook() {
  const response = await GET(request("xlsx"));
  expect(response.headers.get("content-type")).toBe(
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(await response.arrayBuffer());
  return { book, response };
}
const cell = (sheet: ExcelJS.Worksheet, row: number, header: string) =>
  sheet
    .getRow(row)
    .getCell((sheet.getRow(1).values as unknown[]).indexOf(header));
it("exports every playthrough and review field in a real Excel workbook", async () => {
  const { book, response } = await workbook();
  expect(book.worksheets.map((s) => s.name)).toEqual([
    "Juegos",
    "Páginas",
    "Historial de precios",
    "Guía de reseñas",
  ]);
  const sheet = book.getWorksheet("Juegos")!;
  expect(sheet.rowCount).toBe(records.length + 1);
  expect(cell(sheet, 2, "Nombre").value).toBe("=2+2");
  expect(cell(sheet, 2, "Nombre").type).toBe(ExcelJS.ValueType.String);
  expect(cell(sheet, 2, "Empecé").value).toBe("01/02/2026");
  expect(cell(sheet, 3, "Terminé").value).toBe("03/02/2026");
  for (const [header, value] of [
    ["Horas jugadas", 0],
    ["Reseña / 100", 0],
    ["Memorabilidad / 10", 7],
    ["Prioridad", "Migui"],
    ["Hype", "Hyper"],
    ["Horas estimadas", "8 - 12 - 20"],
    ["Por qué", "Una explicación"],
    ["Comentarios adicionales", records[0].notes],
    ["Historia, gameplay o ambos", "Ambos"],
    ["Rejugaría", "Sí"],
    ["Comprado / Acceso familiar", "En Familia"],
  ])
    expect(cell(sheet, 2, String(header)).value).toBe(value);
  expect(cell(sheet, 3, "Horas jugadas").value).toBeNull();
  expect(sheet.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
  expect(sheet.autoFilter).toBeTruthy();
  expect(response.headers.get("cache-control")).toContain("no-store");
});
it("includes current store prices, reference pages and full price history", async () => {
  const { book } = await workbook();
  const pages = book.getWorksheet("Páginas")!;
  expect(pages.rowCount).toBe(3);
  expect(cell(pages, 2, "Precio").value).toBe(0);
  expect(cell(pages, 2, "Precio objetivo").value).toBe(0);
  expect(cell(pages, 2, "Última consulta").value).toBe("03/02/2026, 12:07");
  expect(cell(pages, 3, "URL").value).toBe(ref);
  const history = book.getWorksheet("Historial de precios")!;
  expect(history.rowCount).toBe(2);
  expect(cell(history, 2, "Precio").value).toBe(0);
});
it("keeps long review text intact by splitting Excel cell continuations", async () => {
  const notes = "a".repeat(32766) + "🎮" + "ñ".repeat(18000);
  records[0].notes = notes;
  const { book } = await workbook();
  const sheet = book.getWorksheet("Juegos")!;
  const headers = sheet.getRow(1).values as unknown[];
  const parts = headers.flatMap((h, i) =>
    String(h).startsWith("Comentarios adicionales")
      ? [String(sheet.getRow(2).getCell(i).value ?? "")]
      : [],
  );
  expect(parts.length).toBeGreaterThan(1);
  expect(parts.join("")).toBe(notes);
  expect(parts.every((p) => p.length <= 32767)).toBe(true);
});
it("exports complete CSV columns and neutralizes formula-like text", async () => {
  records[0].title = "  =SUM(1,2)";
  const response = await GET(request("csv"));
  const csv = await response.text();
  for (const header of [
    "Empecé",
    "Terminé",
    "Horas estimadas",
    "Prioridad",
    "Hype",
    "Por qué",
    "Páginas",
  ])
    expect(csv).toContain(header);
  expect(csv).toContain('"\'  =SUM(1,2)"');
  expect(csv).toContain('comillas "" y\nsalto de línea');
});
it("keeps raw source data in JSON and reads every owned offer and history page", async () => {
  cap = 37;
  tables.offers = Array.from({ length: 1203 }, (_, i) => ({
    ...tables.offers[0],
    id: "offer-" + String(i).padStart(5, "0"),
  }));
  tables.price_history = Array.from({ length: 1004 }, (_, i) => ({
    ...tables.price_history[0],
    id: "history-" + String(i).padStart(5, "0"),
  }));
  tables.offers.push({
    ...tables.offers[0],
    id: "other-owner",
    owner_id: "someone-else",
  });
  const response = await GET(request("json"));
  const data = await response.json();
  expect(data.version).toBe(2);
  expect(data.records).toEqual(records);
  expect(data.offers).toHaveLength(1203);
  expect(data.priceHistory).toHaveLength(1004);
  expect(queries.every((q) => q.owner === owner)).toBe(true);
  expect(queries.some((q) => q.after)).toBe(true);
});
it.each(["offers", "price_history"])(
  "fails rather than silently omitting unreadable %s",
  async (table) => {
    errors[table] = "Read failed";
    const response = await GET(request("xlsx"));
    expect(response.status).toBe(400);
    expect(response.headers.get("content-disposition")).toBeNull();
  },
);
it("refuses exports without an authenticated member", async () => {
  auth.mockRejectedValue(new Error("UNAUTHORIZED"));
  const response = await GET(request("xlsx"));
  expect(response.status).toBe(401);
  expect(queries).toHaveLength(0);
});
it("exports readable empty worksheets for an empty collection", async () => {
  records = [];
  tables = { offers: [], price_history: [] };
  const { book } = await workbook();
  expect(
    book.worksheets
      .filter((s) => s.name !== "Guía de reseñas")
      .every((s) => s.rowCount === 1),
  ).toBe(true);
  expect(book.getWorksheet("Guía de reseñas")?.rowCount).toBe(12);
});

it("labels legacy pending entries as wishlist in Excel", async () => {
  records[0].status = "backlog" as JournalRecord["status"];
  const { book } = await workbook();
  expect(cell(book.getWorksheet("Juegos")!, 2, "Estado").value).toBe(
    "Lista de deseos",
  );
});
