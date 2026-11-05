import { z } from "zod";
import { journalEntrySchema } from "@/lib/contracts";
export const importRecordSchema = z.intersection(
  journalEntrySchema,
  z.object({
    links: z.array(z.string()).optional(),
    raw: z.record(z.string(), z.unknown()).optional(),
  }),
);
export const importBatchSchema = z.object({
  batchId: z.uuid(),
  plan: z.array(
    z.object({
      incoming: importRecordSchema,
      id: z.string().optional(),
      expectedUpdatedAt: z.string().optional(),
      kind: z.enum(["add", "update", "conflict", "unchanged"]),
      changes: z.record(z.string(), z.unknown()),
      conflicts: z.array(z.string()),
    }),
  ),
});
export type ImportBatch = z.infer<typeof importBatchSchema>;

export function importConflictLabel(field: string) {
  return field === "cover" ? "Portada" : field;
}

export function importConflictValue(
  incoming: object,
  field: string,
) {
  const record = incoming as Record<string, unknown>;
  const value = record[field];
  if (field === "cover") {
    if (value && typeof value === "object" && "providerUrl" in value)
      return String((value as { providerUrl: unknown }).providerUrl);
    return "sin imagen válida";
  }
  if (value == null || value === "") return "vacío";
  return typeof value === "object" ? "valor estructurado" : String(value);
}
