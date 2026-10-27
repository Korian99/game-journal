import type { JournalEntry } from "./journal-types";
import type { Status } from "../types";
import { recordSchema } from "../validation";
export type QuickFields = {
  status: Status;
  hours: string;
  rating: string;
  priority: string;
};
export function quickFields(entry: JournalEntry): QuickFields {
  return {
    status: entry.status,
    hours: String(entry.hours ?? ""),
    rating: String(entry.rating ?? ""),
    priority: String(entry.priority ?? ""),
  };
}
export function quickDraft(
  entry: JournalEntry,
  fields: QuickFields,
): JournalEntry {
  const numeric = (value: string) =>
    value.trim() === "" ? null : Number(value);
  const parsed = recordSchema.safeParse({
    ...entry,
    status: fields.status,
    hours: numeric(fields.hours),
    rating: numeric(fields.rating),
    priority: fields.priority,
  });
  if (!parsed.success)
    throw Error(
      "Revisá los valores: horas iguales o mayores que cero, reseña de 0 a 100 y una prioridad válida.",
    );
  return { ...entry, ...parsed.data };
}
export function quickUnchanged(
  entry: JournalEntry,
  fields: QuickFields,
): boolean {
  try {
    const candidate = quickDraft(entry, fields),
      original = recordSchema.parse(entry);
    return (["status", "hours", "rating", "priority"] as const).every(
      (key) => candidate[key] === original[key],
    );
  } catch {
    return false;
  }
}
