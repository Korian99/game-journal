import { z } from "zod";
import { dateOrder } from "./view-config";
import type { JournalEntry } from "./journal-types";
export const findingKinds = [
  "invalid-start",
  "invalid-finish",
  "date-order",
  "rating-range",
  "hours-range",
  "status-dates",
  "missing-review",
  "missing-console",
  "missing-hours",
] as const;
export type FindingKind = (typeof findingKinds)[number];
export type FindingCategory = "inconsistency" | "suggestion" | "reminder";
export const dataCheckDefaults = {
  review: false,
  console: false,
  hours: false,
};
export const dataCheckPreferencesSchema = z.strictObject({
  review: z.boolean(),
  console: z.boolean(),
  hours: z.boolean(),
});
export const findingValuesSchema = z
  .array(z.union([z.string().max(5000), z.number().finite(), z.null()]))
  .max(3);
export const dismissalSchema = z.strictObject({
  entry_id: z.uuid(),
  kind: z.enum(findingKinds),
  values: findingValuesSchema,
});
export const dataCheckStateSchema = z.strictObject({
  preferences: dataCheckPreferencesSchema,
  dismissals: z.array(dismissalSchema).max(100000),
});
export type DataCheckState = z.infer<typeof dataCheckStateSchema>;
export type DataFinding = {
  id: string;
  entry: JournalEntry;
  kind: FindingKind;
  category: FindingCategory;
  message: string;
  values: z.infer<typeof findingValuesSchema>;
};
export const findingLabels: Record<FindingKind, string> = {
  "invalid-start": "Fecha de inicio no interpretable",
  "invalid-finish": "Fecha de finalización no interpretable",
  "date-order": "Finalización anterior al inicio",
  "rating-range": "Reseña fuera de rango",
  "hours-range": "Horas fuera de rango",
  "status-dates": "Revisar estado y fechas",
  "missing-review": "Terminado sin reseña",
  "missing-console": "Partida sin consola",
  "missing-hours": "Partida sin horas",
};
export const preferenceLabels = {
  review: "Terminados sin reseña",
  console: "Partidas sin consola",
  hours: "Partidas sin horas",
};
export const categoryLabels = {
  inconsistency: "Inconsistencias",
  suggestion: "Sugerencias",
  reminder: "Recordatorios",
};
export const findingFields: Record<FindingKind, (keyof JournalEntry)[]> = {
  "invalid-start": ["status", "started"],
  "invalid-finish": ["status", "finished"],
  "date-order": ["started", "finished"],
  "rating-range": ["rating"],
  "hours-range": ["hours"],
  "status-dates": ["status", "started", "finished"],
  "missing-review": ["status", "rating"],
  "missing-console": ["status", "device"],
  "missing-hours": ["status", "hours"],
};
export function findingValues(
  kind: FindingKind,
  entry: JournalEntry,
): z.infer<typeof findingValuesSchema> {
  return findingFields[kind].map((field) => {
    const value = entry[field];
    return typeof value === "string" || typeof value === "number"
      ? value
      : null;
  });
}
export function dataChecks(records: JournalEntry[]): DataFinding[] {
  const findings: DataFinding[] = [];
  for (const entry of records) {
    if (!entry.id || ("deleted_at" in entry && entry.deleted_at)) continue;
    const add = (
      kind: FindingKind,
      category: FindingCategory,
      message: string,
    ) =>
      findings.push({
        id: entry.id + ":" + kind,
        entry,
        kind,
        category,
        message,
        values: findingValues(kind, entry),
      });
    const started = dateOrder(entry.started),
      finished = dateOrder(entry.finished);
    // Approximate memory text is valid; impossible exact calendar dates still need review.
    const invalidDate = (value: string, stamp: number | undefined) =>
      value.trim() &&
      stamp === undefined &&
      (entry.status !== "remembered" ||
        /^(?:\d{1,2}[/-]\d{1,2}[/-](?:\d{2}|\d{4})|\d{4}-\d{1,2}-\d{1,2}(?:T.*)?)$/.test(
          value.trim(),
        ));
    if (invalidDate(entry.started, started))
      add(
        "invalid-start",
        "inconsistency",
        "La fecha de inicio no se puede interpretar: " + entry.started,
      );
    if (invalidDate(entry.finished, finished))
      add(
        "invalid-finish",
        "inconsistency",
        "La fecha de finalización no se puede interpretar: " + entry.finished,
      );
    if (started !== undefined && finished !== undefined && finished < started)
      add(
        "date-order",
        "inconsistency",
        "La fecha de finalización es anterior a la de inicio.",
      );
    if (entry.rating !== null && (entry.rating < 0 || entry.rating > 100))
      add(
        "rating-range",
        "inconsistency",
        "La reseña debe estar entre 0 y 100: " + entry.rating,
      );
    if (entry.hours !== null && (entry.hours < 0 || entry.hours > 100000))
      add(
        "hours-range",
        "inconsistency",
        "Las horas deben estar entre 0 y 100000: " + entry.hours,
      );
    if (
      entry.status !== "remembered" &&
      entry.status !== "completed" &&
      finished !== undefined
    )
      add(
        "status-dates",
        "suggestion",
        "Hay una fecha de finalización y el estado no es Terminado. Puede ser intencional; revisa ambos datos.",
      );
    if (entry.status === "completed" && entry.rating === null)
      add(
        "missing-review",
        "reminder",
        "Esta partida está terminada y no tiene reseña.",
      );
    if (
      ["playing", "completed", "paused", "abandoned", "remembered"].includes(
        entry.status,
      )
    ) {
      if (!entry.device.trim())
        add(
          "missing-console",
          "reminder",
          "Esta partida no tiene una consola registrada.",
        );
      if (entry.hours === null)
        add(
          "missing-hours",
          "reminder",
          "Esta partida no tiene horas registradas.",
        );
    }
  }
  return findings;
}
export function findingEnabled(
  finding: DataFinding,
  preferences: DataCheckState["preferences"],
) {
  const key = (
    {
      "missing-review": "review",
      "missing-console": "console",
      "missing-hours": "hours",
    } as const
  )[finding.kind as "missing-review" | "missing-console" | "missing-hours"];
  return !key || preferences[key];
}
export function findingHidden(
  finding: DataFinding,
  dismissals: DataCheckState["dismissals"],
) {
  return dismissals.some(
    (row) =>
      row.entry_id === finding.entry.id &&
      row.kind === finding.kind &&
      JSON.stringify(row.values) === JSON.stringify(finding.values),
  );
}
export const dataCheckCommandSchema = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("preference"),
    key: z.enum(["review", "console", "hours"]),
    enabled: z.boolean(),
  }),
  z.strictObject({
    action: z.literal("dismiss"),
    entryId: z.uuid(),
    kind: z.enum(findingKinds),
    values: findingValuesSchema,
  }),
  z.strictObject({
    action: z.literal("restore"),
    entryId: z.uuid(),
    kind: z.enum(findingKinds),
    values: findingValuesSchema,
  }),
]);
