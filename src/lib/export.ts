import ExcelJS from "exceljs";
import type { ScoringEntry } from "./scoring-guide";
import { emptyRecord, statuses, type JournalRecord, type Offer } from "./types";
import { formatDate, formatDateTime } from "./journal/view-config";
import { releaseLabel } from "./releases";

export type ExportRecord = JournalRecord & { gameId?: string };
export type ExportHistory = {
  id: string;
  offer_id: string;
  price: number;
  currency: string;
  discount: number;
  created_at: string;
};
export type ExportData = {
  records: ExportRecord[];
  offers: Offer[];
  priceHistory: ExportHistory[];
  exportedAt: string;
  scoringGuide?: ScoringEntry[];
  trash?: (ExportRecord & { deleted_at: string })[];
};
type Value = string | number | boolean | null;
type Table = { name: string; headers: string[]; rows: Value[][] };
const gameHeaders = [
  "Nombre",
  "Estado",
  "Período",
  "Plataformas disponibles",
  "Consola donde jugué",
  "Empecé",
  "Terminé",
  "Horas jugadas",
  "Horas estimadas",
  "Reseña / 100",
  "Memorabilidad / 10",
  "Impresiones",
  "Por qué",
  "Comentarios adicionales",
  "Historia, gameplay o ambos",
  "Rejugaría",
  "Prioridad",
  "Hype",
  "Comprado / Acceso familiar",
  "Lanzamiento",
  "Año de lanzamiento",
  "Páginas",
  "ID entrada",
  "ID juego",
  "Origen de importación",
  "Última modificación",
];

function gameTable(data: ExportData): Table {
  const links = new Map<string, string[]>();
  for (const offer of data.offers)
    links.set(offer.game_id, [...(links.get(offer.game_id) ?? []), offer.url]);
  return {
    name: "Juegos",
    headers: gameHeaders,
    rows: data.records.map((input) => {
      const r = { ...emptyRecord, ...input };
      return [
        r.title,
        statuses[r.status] ?? r.status,
        r.period,
        r.platforms,
        r.device,
        formatDate(r.started),
        formatDate(r.finished),
        r.hours,
        r.estimated,
        r.rating,
        r.memorability,
        r.impression,
        r.reason,
        r.notes,
        r.focus,
        r.replay,
        r.priority,
        r.hype,
        r.ownership,
        releaseLabel(r),
        r.year,
        [
          ...new Set([
            ...(links.get(r.gameId ?? "") ?? []),
            ...(r.pages ?? []),
          ]),
        ].join("\n"),
        r.id ?? "",
        r.gameId ?? "",
        r.sourceKey,
        r.updated_at ? formatDateTime(r.updated_at) : "",
      ];
    }),
  };
}
function pageTables(data: ExportData): Table[] {
  const games = new Map<string, ExportRecord[]>();
  for (const record of data.records)
    if (record.gameId)
      games.set(record.gameId, [...(games.get(record.gameId) ?? []), record]);
  const names = (gameId: string) =>
    [...new Set((games.get(gameId) ?? []).map((r) => r.title))].join("; ");
  const offered = new Set(data.offers.map((o) => o.game_id + "\0" + o.url));
  const rows: Value[][] = data.offers.map((o) => [
    names(o.game_id),
    "Tienda",
    o.url,
    o.store,
    o.region,
    o.price,
    o.currency,
    o.regular_price,
    o.discount,
    o.status,
    o.checked_at ? formatDateTime(o.checked_at) : "",
    o.last_success_at ? formatDateTime(o.last_success_at) : "",
    o.watched,
    o.target_price,
    o.error ?? "",
    o.id,
    o.game_id,
    (games.get(o.game_id) ?? []).map((r) => r.id).join("; "),
  ]);
  const references = new Map<
    string,
    { record: ExportRecord; url: string; entries: string[] }
  >();
  for (const record of data.records)
    for (const url of record.pages ?? []) {
      const key = (record.gameId ?? record.id ?? "") + "\0" + url;
      if (offered.has(key)) continue;
      const existing = references.get(key);
      if (existing) {
        if (record.id && !existing.entries.includes(record.id))
          existing.entries.push(record.id);
      } else
        references.set(key, {
          record,
          url,
          entries: record.id ? [record.id] : [],
        });
    }
  for (const { record, url, entries } of references.values())
    rows.push([
      record.title,
      "Referencia",
      url,
      "",
      "",
      null,
      "",
      null,
      null,
      "",
      "",
      "",
      false,
      null,
      "",
      "",
      record.gameId ?? "",
      entries.join("; "),
    ]);
  const offers = new Map(data.offers.map((o) => [o.id, o]));
  return [
    {
      name: "Páginas",
      headers: [
        "Nombre",
        "Tipo",
        "URL",
        "Tienda",
        "Región",
        "Precio",
        "Moneda",
        "Precio habitual",
        "Descuento %",
        "Estado de tienda",
        "Última consulta",
        "Último precio válido",
        "Notificaciones",
        "Precio objetivo",
        "Error de consulta",
        "ID página",
        "ID juego",
        "IDs entradas",
      ],
      rows,
    },
    {
      name: "Historial de precios",
      headers: [
        "Nombre",
        "Tienda",
        "Región",
        "Precio",
        "Moneda",
        "Descuento %",
        "Fecha",
        "ID historial",
        "ID página",
        "ID juego",
      ],
      rows: data.priceHistory.map((h) => {
        const offer = offers.get(h.offer_id);
        return [
          offer ? names(offer.game_id) : "",
          offer?.store ?? "",
          offer?.region ?? "",
          h.price,
          h.currency,
          h.discount,
          formatDateTime(h.created_at),
          h.id,
          h.offer_id,
          offer?.game_id ?? "",
        ];
      }),
    },
  ];
}

// Excel limits text cells to 32,767 UTF-16 code units. Preserve overflow in
// adjacent continuation columns, without splitting an emoji's surrogate pair.
function chunks(value: Value): Value[] {
  if (typeof value !== "string" || value.length <= 32767) return [value];
  const parts: string[] = [];
  for (let start = 0; start < value.length;) {
    let end = Math.min(start + 32767, value.length);
    if (
      end < value.length &&
      /[\uD800-\uDBFF]/.test(value[end - 1]) &&
      /[\uDC00-\uDFFF]/.test(value[end])
    )
      end--;
    parts.push(value.slice(start, end));
    start = end;
  }
  return parts;
}
function fitExcel(table: Table): Table {
  const splitRows = table.rows.map((row) => row.map(chunks));
  const sizes = table.headers.map((_, i) =>
    splitRows.reduce((max, row) => Math.max(max, row[i].length), 1),
  );
  return {
    ...table,
    headers: table.headers.flatMap((header, i) =>
      Array.from({ length: sizes[i] }, (_, part) =>
        part ? header + " (continuación " + (part + 1) + ")" : header,
      ),
    ),
    rows: splitRows.map((row) =>
      row.flatMap((values, i) =>
        Array.from({ length: sizes[i] }, (_, part) => values[part] ?? null),
      ),
    ),
  };
}
export async function excelExport(
  data: ExportData,
): Promise<Uint8Array<ArrayBuffer>> {
  const book = new ExcelJS.Workbook();
  book.creator = "Game Journal";
  book.created = new Date(data.exportedAt);
  book.modified = new Date(data.exportedAt);
  const trashed = data.trash
    ? gameTable({ ...data, records: data.trash })
    : null;
  const trashTable: Table[] = trashed
    ? [
        {
          name: "Papelera",
          headers: [...trashed.headers, "Eliminada"],
          rows: trashed.rows.map((row, index) => [
            ...row,
            formatDateTime(data.trash![index].deleted_at),
          ]),
        },
      ]
    : [];
  for (const original of [
    gameTable(data),
    ...trashTable,
    ...pageTables(data),
    ...(data.scoringGuide
      ? [
          {
            name: "Guía de reseñas",
            headers: ["Puntaje", "Significado"],
            rows: data.scoringGuide.map((entry) => [
              entry.score_threshold,
              entry.meaning,
            ]),
          },
        ]
      : []),
  ]) {
    const table = fitExcel(original);
    if (table.rows.length > 1048575 || table.headers.length > 16384)
      throw Error(
        "La colección supera el límite de Excel. Descargá el respaldo JSON.",
      );
    const sheet = book.addWorksheet(table.name, {
      views: [{ state: "frozen", ySplit: 1, xSplit: 1 }],
    });
    sheet.columns = table.headers.map((header) => ({
      header,
      width: /Comentarios|Por qué|URL|Páginas|Significado/.test(header)
        ? 60
        : header === "Nombre"
          ? 36
          : 22,
    }));
    sheet.addRows(table.rows);
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: table.rows.length + 1, column: table.headers.length },
    };
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF354A37" },
    };
    sheet.getRow(1).height = 30;
    sheet.eachRow((row, index) => {
      row.alignment = { vertical: "top", wrapText: true };
      if (index > 1) {
        row.height = 45;
        row.eachCell((cell) => {
          if (typeof cell.value === "number") cell.numFmt = "0.##";
        });
      }
    });
  }
  return new Uint8Array(await book.xlsx.writeBuffer());
}
export function csvExport(data: ExportData): string {
  const table = gameTable(data);
  const cell = (value: Value) => {
    const text = String(value ?? "");
    const prefix =
      typeof value === "string" &&
      (/^[\s\uFEFF]*[=+\-@]/.test(text) || /^[\t\r]/.test(text))
        ? "'"
        : "";
    return '"' + prefix + text.replaceAll('"', '""') + '"';
  };
  return (
    "\uFEFF" +
    [table.headers, ...table.rows]
      .map((row) => row.map(cell).join(","))
      .join("\r\n")
  );
}
