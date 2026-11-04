import { z } from "zod";
import { effectiveCoverUrl, type Cover } from "./covers";
import type { JournalEntry } from "./journal/journal-types";

type SeriesPlaythrough = Pick<
  JournalEntry,
  "gameId" | "title" | "status" | "cover"
> & {
  deleted_at?: string | null;
};
export type SeriesProgressGame = {
  gameId: string;
  title: string;
  cover?: Cover;
  completed: boolean;
  available: boolean;
};

export function getSeriesProgress(
  gameIds: readonly string[],
  records: readonly SeriesPlaythrough[],
) {
  const active = new Map<string, SeriesPlaythrough[]>();
  for (const record of records) {
    if (!record.gameId || record.deleted_at) continue;
    const plays = active.get(record.gameId) ?? [];
    plays.push(record);
    active.set(record.gameId, plays);
  }
  const games: SeriesProgressGame[] = [...new Set(gameIds)].map((gameId) => {
    const plays = active.get(gameId) ?? [];
    return {
      gameId,
      title:
        plays.find((play) => play.title.trim())?.title ?? "Juego no disponible",
      cover: plays.find((play) => effectiveCoverUrl(play.cover))?.cover,
      completed: plays.some(
        (play) => play.status === "completed" || play.status === "remembered",
      ),
      available: plays.length > 0,
    };
  });
  return {
    games,
    total: games.length,
    completed: games.filter((game) => game.completed).length,
    next: games.find((game) => !game.completed),
  };
}

export const seriesNameSchema = z
  .string()
  .trim()
  .min(1, "El nombre de la serie es obligatorio.")
  .max(80, "El nombre de la serie no puede superar los 80 caracteres.");

export const seriesSaveSchema = z.strictObject({
  name: seriesNameSchema,
  gameIds: z
    .array(z.uuid())
    .max(500)
    .refine((gameIds) => new Set(gameIds).size === gameIds.length, {
      message: "Un juego no puede repetirse dentro de una serie.",
    }),
});

export type SeriesSave = z.infer<typeof seriesSaveSchema>;

export function reorderSeriesGames(
  gameIds: readonly string[],
  gameId: string,
  direction: "up" | "down",
): string[] {
  const ordered = [...gameIds];
  const index = ordered.indexOf(gameId);
  const target = index + (direction === "up" ? -1 : 1);
  if (index < 0 || target < 0 || target >= ordered.length) return ordered;
  [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
  return ordered;
}

export const seriesCommandSchema = z
  .strictObject({
    id: z.uuid().optional(),
    name: seriesNameSchema,
    gameIds: seriesSaveSchema.shape.gameIds,
    updatedAt: z.iso.datetime({ offset: true }).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.id && !value.updatedAt)
      ctx.addIssue({
        code: "custom",
        path: ["updatedAt"],
        message: "La serie cambió. Actualiza antes de guardar.",
      });
    if (!value.id && value.updatedAt)
      ctx.addIssue({
        code: "custom",
        path: ["updatedAt"],
        message: "No se esperaba una versión para una serie nueva.",
      });
  });

export const seriesRecordSchema = z.strictObject({
  id: z.uuid(),
  name: seriesNameSchema,
  updatedAt: z.iso.datetime({ offset: true }),
  gameIds: seriesSaveSchema.shape.gameIds,
});
export const seriesListSchema = z.array(seriesRecordSchema);
export const seriesDeleteSchema = z.strictObject({
  id: z.uuid(),
  updatedAt: z.iso.datetime({ offset: true }),
});

export type SeriesRecord = z.infer<typeof seriesRecordSchema>;
