import { formatDate } from "./journal/view-config";
import { z } from "zod";
import { normalizeConsoleLabels } from "./journal/console-labels";
import { statusSchema } from "./journal/status-schema";
import { parseRelease } from "./releases";
import { coverSchema } from "./covers";
export const releaseSchema = z
  .string()
  .trim()
  .max(30)
  .refine(
    (value) => value === "" || parseRelease(value).kind !== "unknown",
    "Completá la fecha, la temporada y su año, o solo el año (1950–2200).",
  );
const numberOrNull = (min: number, max: number) =>
  z.number().min(min).max(max).nullable();
export const pageSchema = z
  .string()
  .trim()
  .min(1)
  .max(2000)
  .refine((value) => {
    try {
      const page = new URL(value);
      return (
        page.protocol === "https:" &&
        !page.username &&
        !page.password &&
        !page.port &&
        /^[a-zA-Z0-9.-]+$/.test(page.hostname)
      );
    } catch {
      return false;
    }
  }, "Usá un enlace HTTPS válido, sin usuario ni contraseña.")
  .transform((value) => new URL(value).href)
  .pipe(z.string().max(2000));
export const pagesSchema = z
  .array(pageSchema)
  .max(20, "Podés agregar hasta 20 páginas.")
  .transform((pages) => [...new Set(pages)]);
export const recordSchema = z
  .object({
    cover: coverSchema.optional(),
    id: z.uuid().optional(),
    gameId: z.uuid().optional(),
    title: z.string().trim().min(1).max(300),
    year: numberOrNull(1950, 2200),
    release: releaseSchema.optional(),
    platforms: z.string().max(2000).transform(normalizeConsoleLabels),
    device: z.string().max(200).transform(normalizeConsoleLabels),
    period: z.string().max(100),
    started: z
      .string()
      .max(100)
      .nullable()
      .transform((value) => formatDate(value ?? "")),
    finished: z
      .string()
      .max(100)
      .nullable()
      .transform((value) => formatDate(value ?? "")),
    status: statusSchema,
    ownership: z.string().max(100),
    priority: z.preprocess(
      (value) => {
        if (typeof value !== "string") return value;
        const text = value.trim();
        return text === ""
          ? null
          : Number.isFinite(Number(text))
            ? Number(text)
            : text;
      },
      z.union([numberOrNull(0, 100), z.string().min(1).max(100)]),
    ),
    hype: z.string().max(100),
    hours: numberOrNull(0, 100000),
    estimated: z.string().max(200),
    rating: numberOrNull(0, 100),
    memorability: numberOrNull(0, 10),
    impression: z.string().max(200),
    focus: z.string().max(100),
    replay: z.string().max(100),
    reason: z.string().max(20000),
    notes: z.string().max(50000),
    sourceKey: z.string().max(1000),
    pages: pagesSchema.optional(),
    updated_at: z.string().optional(),
  })
  .transform((record) => {
    if (record.release === "") record.year = null;
    if (record.release) {
      const release = parseRelease(record.release);
      if (release.kind !== "unknown") record.year = release.year;
    }
    return record;
  });
export async function bodyJson(request: Request) {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 5_000_000) throw Error("Carga demasiado grande");
  const text = await request.text();
  if (text.length > 5_000_000) throw Error("Carga demasiado grande");
  return JSON.parse(text);
}

export { recordsResponseSchema, offersSchema } from "./contracts";
