import { recordRelease } from "../releases";
import { recordSchema } from "../validation";
import { dateOrder, formatDate } from "./view-config";
import { statusAfterDateEdits } from "./entry-status";
import { periodAfterDateEdits } from "./entry-period";
import type { JournalEntry } from "./journal-types";

export const inlineFields = {
  title: { label: "Nombre", type: "text" },
  device: { label: "Consola", type: "device" },
  status: { label: "Estado", type: "status" },
  period: { label: "Período", type: "text" },
  started: { label: "Empecé", type: "date" },
  finished: { label: "Terminé", type: "date" },
  hours: { label: "Hs. jugadas", type: "number" },
  estimated: { label: "Hs. estimadas", type: "text" },
  rating: { label: "Reseña", type: "number" },
  memorability: { label: "Memorabilidad", type: "number" },
  impression: { label: "Impresiones", type: "text" },
  reason: { label: "Por qué", type: "textarea" },
  notes: { label: "Comentarios adicionales", type: "textarea" },
  priority: { label: "Prioridad", type: "text" },
  ownership: { label: "Acceso", type: "ownership" },
  hype: { label: "Hype", type: "hype" },
  release: { label: "Lanzamiento", type: "release" },
} as const;
export type InlineFieldName = keyof typeof inlineFields;
const trackedFields = [...Object.keys(inlineFields), "year"] as (
  InlineFieldName | "year"
)[];
const gameFields = [
  "title",
  "year",
  "release",
  "platforms",
  "ownership",
  "priority",
  "hype",
  "estimated",
  "pages",
] as const;
export type InlineChange = {
  id: string;
  label: string;
  before: Partial<JournalEntry>;
  after: Partial<JournalEntry>;
};
export function inlineValue(
  entry: JournalEntry,
  field: InlineFieldName,
): string {
  if (field === "release") {
    const release = recordRelease(entry);
    return release.kind === "unknown" ? "" : release.value;
  }
  return field === "started" || field === "finished"
    ? formatDate(entry[field])
    : String(entry[field] ?? "");
}
export function inlineUnchanged(
  entry: JournalEntry,
  field: InlineFieldName,
  raw: string,
): boolean {
  const original = inlineValue(entry, field);
  if (raw === original) return true;
  if (field === "release") return raw.trim() === original;
  if (field === "started" || field === "finished") {
    const date = dateOrder(raw);
    return date !== undefined && date === dateOrder(entry[field]);
  }
  try {
    return (
      inlineCandidate(entry, field, raw)[field] ===
      recordSchema.parse(entry)[field]
    );
  } catch {
    return false;
  }
}

export function inlineCandidate(
  entry: JournalEntry,
  field: InlineFieldName,
  raw: string,
): JournalEntry {
  const value =
    inlineFields[field].type === "number"
      ? raw.trim() === ""
        ? null
        : Number(raw)
      : raw;
  if (
    (field === "started" || field === "finished") &&
    raw.trim() &&
    dateOrder(raw) === undefined
  )
    throw Error("Usá una fecha válida en formato dd/mm/aaaa.");
  const candidate = { ...entry, [field]: value };
  if (field === "started" || field === "finished") {
    candidate.status = statusAfterDateEdits(candidate, entry);
    candidate.period = periodAfterDateEdits(candidate, entry);
  }
  const result = recordSchema.safeParse(candidate);
  if (!result.success)
    throw Error(result.error.issues[0]?.message ?? "Revisá el dato.");
  return { ...entry, ...result.data };
}
export function inlineChange(
  before: JournalEntry,
  after: JournalEntry,
  label: string,
): InlineChange {
  const fields = trackedFields.filter(
    (field) => before[field] !== after[field],
  );
  const previous = Object.fromEntries(
    fields.map((field) => [field, before[field]]),
  );
  if (fields.includes("release") && before.release === undefined) {
    const release = recordRelease(before);
    previous.release = release.kind === "unknown" ? "" : release.value;
  }
  return {
    id: after.id!,
    label,
    before: previous,
    after: Object.fromEntries(fields.map((field) => [field, after[field]])),
  };
}
export function undoCandidate(
  current: JournalEntry,
  change: InlineChange,
): JournalEntry {
  if (
    current.id !== change.id ||
    Object.entries(change.after).some(
      ([field, value]) => current[field as keyof JournalEntry] !== value,
    )
  )
    throw Error(
      "Este dato cambió después de tu edición. No se deshizo para conservar los cambios nuevos.",
    );
  return { ...current, ...change.before };
}
export function mergeSavedEntry(
  records: JournalEntry[],
  saved: JournalEntry,
): JournalEntry[] {
  return records.map((record) =>
    record.id === saved.id
      ? saved
      : record.gameId && record.gameId === saved.gameId
        ? {
            ...record,
            ...Object.fromEntries(
              gameFields
                .filter((field) => field in saved)
                .map((field) => [field, saved[field]]),
            ),
          }
        : record,
  );
}
