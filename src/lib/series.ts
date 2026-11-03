import { z } from "zod";

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
